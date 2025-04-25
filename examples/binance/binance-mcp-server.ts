import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import http from 'http';
import cors from 'cors';
import { Connection } from '@solana/web3.js';
import { BinanceContext } from './binance-context';
import { logger } from '../../src/utils/logger';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Create Express application
const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Binance context
const binanceContext = new BinanceContext();

// API routes
const apiRouter = express.Router();

// Health check endpoint
apiRouter.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get price endpoint
apiRouter.get('/price/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }
    
    const price = await binanceContext.getPrice(symbol);
    
    res.json({ 
      symbol, 
      price,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Error fetching price: ${error}`);
    res.status(500).json({ 
      error: 'Failed to fetch price',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get order book endpoint
apiRouter.get('/orderbook/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const depth = req.query.depth ? parseInt(req.query.depth as string) : 20;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }
    
    const orderBook = await binanceContext.getOrderBook(symbol, depth);
    
    res.json({
      symbol,
      orderBook,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Error fetching order book: ${error}`);
    res.status(500).json({ 
      error: 'Failed to fetch order book',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get klines endpoint
apiRouter.get('/klines/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const interval = req.query.interval as string || '1h';
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }
    
    const klines = await binanceContext.getKlines(symbol, interval, limit);
    
    // Format the response to be more user-friendly
    const formattedKlines = klines.map(k => ({
      openTime: k[0],
      open: k[1],
      high: k[2],
      low: k[3],
      close: k[4],
      volume: k[5],
      closeTime: k[6],
      quoteAssetVolume: k[7],
      trades: k[8],
      takerBuyBaseAssetVolume: k[9],
      takerBuyQuoteAssetVolume: k[10]
    }));
    
    res.json({
      symbol,
      interval,
      klines: formattedKlines,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Error fetching klines: ${error}`);
    res.status(500).json({ 
      error: 'Failed to fetch klines',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Context definition endpoint
apiRouter.get('/context', (req, res) => {
  res.json(BinanceContext.getContextDefinition());
});

// Mount the API router
app.use('/api', apiRouter);

// Socket.IO handling
io.on('connection', (socket) => {
  logger.info(`New client connected: ${socket.id}`);
  
  // Handle subscribe to ticker
  socket.on('subscribe:ticker', (data) => {
    const { symbol } = data;
    
    if (!symbol) {
      socket.emit('error', { message: 'Symbol is required' });
      return;
    }
    
    logger.info(`Client ${socket.id} subscribed to ticker for ${symbol}`);
    
    binanceContext.connectToStream(symbol, 'ticker', (tickerData) => {
      socket.emit('ticker', {
        symbol: tickerData.s,
        price: tickerData.c,
        priceChangePercent: tickerData.P,
        volume: tickerData.v,
        timestamp: tickerData.E
      });
    });
  });
  
  // Handle subscribe to order book
  socket.on('subscribe:orderbook', (data) => {
    const { symbol } = data;
    
    if (!symbol) {
      socket.emit('error', { message: 'Symbol is required' });
      return;
    }
    
    logger.info(`Client ${socket.id} subscribed to order book for ${symbol}`);
    
    binanceContext.connectToStream(symbol, 'depth', (depthData) => {
      socket.emit('orderbook', {
        symbol: depthData.s,
        bids: depthData.b,
        asks: depthData.a,
        timestamp: depthData.E
      });
    });
  });
  
  // Handle unsubscribe
  socket.on('unsubscribe', (data) => {
    const { symbol, stream } = data;
    logger.info(`Client ${socket.id} unsubscribed from ${stream} for ${symbol}`);
    // Additional logic for unsubscribing would go here
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Start the server
const PORT = process.env.PORT || 3100;
server.listen(PORT, () => {
  logger.info(`Binance MCP Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  // Close all WebSocket connections
  binanceContext.close();
  
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});
