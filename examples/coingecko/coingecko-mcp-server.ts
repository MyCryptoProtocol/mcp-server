import express from 'express';
import http from 'http';
import cors from 'cors';
import { CoinGeckoContext } from './coingecko-context';
import { logger } from '../../src/utils/logger';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Create Express application
const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// Initialize CoinGecko context
const coinGeckoContext = new CoinGeckoContext(process.env.COINGECKO_API_KEY);

// API routes
const apiRouter = express.Router();

// Health check endpoint
apiRouter.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Context definition endpoint
apiRouter.get('/context', (req, res) => {
  res.json(CoinGeckoContext.getContextDefinition());
});

// Get coin list endpoint
apiRouter.get('/coins', async (req, res) => {
  try {
    const perPage = req.query.per_page ? parseInt(req.query.per_page as string) : 100;
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    
    const coins = await coinGeckoContext.getCoinList(perPage, page);
    
    res.json({
      count: coins.length,
      page,
      per_page: perPage,
      coins,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Error fetching coin list: ${error}`);
    res.status(500).json({ 
      error: 'Failed to fetch coin list',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get coin price endpoint
apiRouter.get('/price/:coinId', async (req, res) => {
  try {
    const { coinId } = req.params;
    const vsCurrency = (req.query.vs_currency as string) || 'usd';
    
    if (!coinId) {
      return res.status(400).json({ error: 'Coin ID is required' });
    }
    
    const price = await coinGeckoContext.getCoinPrice(coinId, vsCurrency);
    
    res.json({
      coin_id: coinId,
      vs_currency: vsCurrency,
      price,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Error fetching coin price: ${error}`);
    res.status(500).json({ 
      error: 'Failed to fetch coin price',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get coin details endpoint
apiRouter.get('/coins/:coinId', async (req, res) => {
  try {
    const { coinId } = req.params;
    
    if (!coinId) {
      return res.status(400).json({ error: 'Coin ID is required' });
    }
    
    const details = await coinGeckoContext.getCoinDetails(coinId);
    
    res.json({
      ...details,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Error fetching coin details: ${error}`);
    res.status(500).json({ 
      error: 'Failed to fetch coin details',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get market chart endpoint
apiRouter.get('/market-chart/:coinId', async (req, res) => {
  try {
    const { coinId } = req.params;
    const vsCurrency = (req.query.vs_currency as string) || 'usd';
    const days = req.query.days ? parseInt(req.query.days as string) : 30;
    
    if (!coinId) {
      return res.status(400).json({ error: 'Coin ID is required' });
    }
    
    const marketData = await coinGeckoContext.getMarketChart(coinId, vsCurrency, days);
    
    res.json({
      coin_id: coinId,
      vs_currency: vsCurrency,
      days,
      market_data: marketData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Error fetching market chart: ${error}`);
    res.status(500).json({ 
      error: 'Failed to fetch market chart',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get OHLC data endpoint
apiRouter.get('/ohlc/:coinId', async (req, res) => {
  try {
    const { coinId } = req.params;
    const vsCurrency = (req.query.vs_currency as string) || 'usd';
    const days = req.query.days ? parseInt(req.query.days as string) : 14;
    
    if (!coinId) {
      return res.status(400).json({ error: 'Coin ID is required' });
    }
    
    const ohlcData = await coinGeckoContext.getOHLC(coinId, vsCurrency, days);
    
    // Format OHLC data to be more readable
    const formattedData = ohlcData.map(([timestamp, open, high, low, close]) => ({
      timestamp,
      date: new Date(timestamp).toISOString(),
      open,
      high,
      low,
      close
    }));
    
    res.json({
      coin_id: coinId,
      vs_currency: vsCurrency,
      days,
      ohlc: formattedData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Error fetching OHLC data: ${error}`);
    res.status(500).json({ 
      error: 'Failed to fetch OHLC data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get global market data endpoint
apiRouter.get('/global', async (req, res) => {
  try {
    const globalData = await coinGeckoContext.getGlobalData();
    
    res.json({
      ...globalData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Error fetching global market data: ${error}`);
    res.status(500).json({ 
      error: 'Failed to fetch global market data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Search endpoint
apiRouter.get('/search', async (req, res) => {
  try {
    const query = req.query.q as string;
    
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    
    const searchResults = await coinGeckoContext.search(query);
    
    res.json({
      query,
      results: searchResults,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Error performing search: ${error}`);
    res.status(500).json({ 
      error: 'Failed to perform search',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Mount the API router
app.use('/api', apiRouter);

// Start the server
const PORT = process.env.PORT || 3200;
server.listen(PORT, () => {
  logger.info(`CoinGecko MCP Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Using CoinGecko ${process.env.COINGECKO_API_KEY ? 'Pro' : 'Free'} API`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});
