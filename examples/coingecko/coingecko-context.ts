import { ContextDefinition, ContextType } from '../../src/context-manager';
import axios from 'axios';
import NodeCache from 'node-cache';

/**
 * Type definitions for CoinGecko data
 */
export interface CoinGeckoCoin {
  id: string;
  symbol: string;
  name: string;
  image?: string;
  current_price?: number;
  market_cap?: number;
  market_cap_rank?: number;
  price_change_percentage_24h?: number;
  price_change_percentage_7d?: number;
  price_change_percentage_30d?: number;
}

export interface CoinGeckoMarketData {
  prices: [number, number][]; // [timestamp, price]
  market_caps: [number, number][]; // [timestamp, market_cap]
  total_volumes: [number, number][]; // [timestamp, volume]
}

/**
 * Context implementation for CoinGecko data
 */
export class CoinGeckoContext {
  private apiBaseUrl: string;
  private apiKey?: string;
  private cache: NodeCache;
  private isProAccount: boolean;
  
  constructor(apiKey?: string) {
    this.apiBaseUrl = 'https://api.coingecko.com/api/v3';
    this.apiKey = apiKey;
    this.isProAccount = !!apiKey;
    
    // If using Pro account, use the pro API URL
    if (this.isProAccount) {
      this.apiBaseUrl = 'https://pro-api.coingecko.com/api/v3';
    }
    
    // Initialize cache with default TTL of 5 minutes
    this.cache = new NodeCache({ stdTTL: 300 });
  }
  
  /**
   * Get the context definition for CoinGecko
   */
  static getContextDefinition(): ContextDefinition {
    return {
      id: 'coingecko-market-data',
      name: 'CoinGecko Market Data',
      description: 'Cryptocurrency market data provided by CoinGecko API',
      type: ContextType.ORACLE,
      capabilities: [
        'coin_list',
        'coin_price',
        'historical_data',
        'market_data',
        'global_metrics'
      ],
      endpoint: 'https://api.coingecko.com/api/v3',
      authRequired: false,
      schema: {
        coinPrice: {
          id: 'string',
          vs_currency: 'string'
        },
        marketData: {
          id: 'string',
          vs_currency: 'string',
          days: 'number'
        },
        coinList: {
          per_page: 'number',
          page: 'number'
        }
      }
    };
  }
  
  /**
   * Make an authenticated API request to CoinGecko
   * @param endpoint API endpoint
   * @param params Query parameters
   * @returns API response
   */
  private async makeRequest(endpoint: string, params: Record<string, any> = {}): Promise<any> {
    try {
      // Add API key for Pro accounts
      if (this.isProAccount) {
        params.x_cg_pro_api_key = this.apiKey;
      }
      
      // Rate limiting logic for free tier (3 calls/second, max 50 calls/minute)
      if (!this.isProAccount) {
        await new Promise(resolve => setTimeout(resolve, 350)); // ~3 req/sec
      }
      
      const response = await axios.get(`${this.apiBaseUrl}${endpoint}`, { params });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const { status, statusText, data } = error.response;
        console.error(`CoinGecko API Error (${status} ${statusText}):`, data);
        
        if (status === 429) {
          throw new Error('CoinGecko API rate limit exceeded. Please try again later.');
        }
      }
      throw error;
    }
  }
  
  /**
   * Get the list of supported coins
   * @param perPage Number of results per page
   * @param page Page number
   * @returns List of supported coins
   */
  async getCoinList(perPage: number = 100, page: number = 1): Promise<CoinGeckoCoin[]> {
    const cacheKey = `coin_list_${perPage}_${page}`;
    
    // Check cache first
    const cachedData = this.cache.get<CoinGeckoCoin[]>(cacheKey);
    if (cachedData) {
      return cachedData;
    }
    
    try {
      const data = await this.makeRequest('/coins/markets', {
        vs_currency: 'usd',
        order: 'market_cap_desc',
        per_page: perPage,
        page,
        sparkline: false
      });
      
      // Cache the result
      this.cache.set(cacheKey, data);
      
      return data;
    } catch (error) {
      console.error('Error fetching coin list:', error);
      throw new Error('Failed to fetch coin list from CoinGecko');
    }
  }
  
  /**
   * Get current price of a coin
   * @param coinId Coin ID
   * @param vsCurrency Currency to convert to
   * @returns Price in the specified currency
   */
  async getCoinPrice(coinId: string, vsCurrency: string = 'usd'): Promise<number> {
    const cacheKey = `coin_price_${coinId}_${vsCurrency}`;
    
    // Check cache first
    const cachedData = this.cache.get<number>(cacheKey);
    if (cachedData) {
      return cachedData;
    }
    
    try {
      const data = await this.makeRequest('/simple/price', {
        ids: coinId,
        vs_currencies: vsCurrency
      });
      
      const price = data[coinId][vsCurrency];
      
      // Cache for a shorter time (1 minute) since prices change frequently
      this.cache.set(cacheKey, price, 60);
      
      return price;
    } catch (error) {
      console.error(`Error fetching price for ${coinId}:`, error);
      throw new Error(`Failed to fetch price for ${coinId} from CoinGecko`);
    }
  }
  
  /**
   * Get detailed information about a coin
   * @param coinId Coin ID
   * @returns Detailed coin information
   */
  async getCoinDetails(coinId: string): Promise<any> {
    const cacheKey = `coin_details_${coinId}`;
    
    // Check cache first
    const cachedData = this.cache.get<any>(cacheKey);
    if (cachedData) {
      return cachedData;
    }
    
    try {
      const data = await this.makeRequest(`/coins/${coinId}`, {
        localization: false,
        tickers: false,
        market_data: true,
        community_data: false,
        developer_data: false
      });
      
      // Cache the result
      this.cache.set(cacheKey, data);
      
      return data;
    } catch (error) {
      console.error(`Error fetching details for ${coinId}:`, error);
      throw new Error(`Failed to fetch details for ${coinId} from CoinGecko`);
    }
  }
  
  /**
   * Get historical market data for a coin
   * @param coinId Coin ID
   * @param vsCurrency Currency to convert to
   * @param days Number of days of data to retrieve
   * @returns Historical market data
   */
  async getMarketChart(coinId: string, vsCurrency: string = 'usd', days: number = 30): Promise<CoinGeckoMarketData> {
    const cacheKey = `market_chart_${coinId}_${vsCurrency}_${days}`;
    
    // Check cache first
    const cachedData = this.cache.get<CoinGeckoMarketData>(cacheKey);
    if (cachedData) {
      return cachedData;
    }
    
    try {
      const data = await this.makeRequest(`/coins/${coinId}/market_chart`, {
        vs_currency: vsCurrency,
        days
      });
      
      // Cache the result
      this.cache.set(cacheKey, data);
      
      return data;
    } catch (error) {
      console.error(`Error fetching market chart for ${coinId}:`, error);
      throw new Error(`Failed to fetch market chart for ${coinId} from CoinGecko`);
    }
  }
  
  /**
   * Get OHLC data for a coin
   * @param coinId Coin ID
   * @param vsCurrency Currency to convert to
   * @param days Number of days of data to retrieve
   * @returns OHLC candlestick data
   */
  async getOHLC(coinId: string, vsCurrency: string = 'usd', days: number = 14): Promise<[number, number, number, number, number][]> {
    const cacheKey = `ohlc_${coinId}_${vsCurrency}_${days}`;
    
    // Check cache first
    const cachedData = this.cache.get<[number, number, number, number, number][]>(cacheKey);
    if (cachedData) {
      return cachedData;
    }
    
    try {
      const data = await this.makeRequest(`/coins/${coinId}/ohlc`, {
        vs_currency: vsCurrency,
        days
      });
      
      // Cache the result
      this.cache.set(cacheKey, data);
      
      return data;
    } catch (error) {
      console.error(`Error fetching OHLC data for ${coinId}:`, error);
      throw new Error(`Failed to fetch OHLC data for ${coinId} from CoinGecko`);
    }
  }
  
  /**
   * Get global cryptocurrency market data
   * @returns Global market data
   */
  async getGlobalData(): Promise<any> {
    const cacheKey = 'global_data';
    
    // Check cache first
    const cachedData = this.cache.get<any>(cacheKey);
    if (cachedData) {
      return cachedData;
    }
    
    try {
      const data = await this.makeRequest('/global');
      
      // Cache the result
      this.cache.set(cacheKey, data);
      
      return data;
    } catch (error) {
      console.error('Error fetching global market data:', error);
      throw new Error('Failed to fetch global market data from CoinGecko');
    }
  }
  
  /**
   * Search for coins, categories, and markets
   * @param query Search query
   * @returns Search results
   */
  async search(query: string): Promise<any> {
    const cacheKey = `search_${query}`;
    
    // Check cache first
    const cachedData = this.cache.get<any>(cacheKey);
    if (cachedData) {
      return cachedData;
    }
    
    try {
      const data = await this.makeRequest('/search', { query });
      
      // Cache the result
      this.cache.set(cacheKey, data);
      
      return data;
    } catch (error) {
      console.error(`Error searching for "${query}":`, error);
      throw new Error(`Failed to search for "${query}" on CoinGecko`);
    }
  }
}
