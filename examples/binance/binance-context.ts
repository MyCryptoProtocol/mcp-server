import { ContextDefinition, ContextType } from '../../src/context-manager';
import WebSocket from 'ws';
import axios from 'axios';

/**
 * Type definitions for Binance market data
 */
export interface BinanceMarketData {
  symbol: string;
  price: string;
  time: number;
}

export interface BinanceOrderBookData {
  symbol: string;
  bids: [string, string][];  // [price, quantity]
  asks: [string, string][];  // [price, quantity]
  time: number;
}

/**
 * Context implementation for Binance market data
 */
export class BinanceContext {
  private wsConnections: Map<string, WebSocket> = new Map();
  private marketData: Map<string, BinanceMarketData> = new Map();
  private orderBooks: Map<string, BinanceOrderBookData> = new Map();
  private callbacks: Map<string, ((data: any) => void)[]> = new Map();
  
  /**
   * Get the context definition for Binance
   */
  static getContextDefinition(): ContextDefinition {
    return {
      id: 'binance-exchange',
      name: 'Binance Exchange',
      description: 'Real-time market data and trading API for Binance cryptocurrency exchange',
      type: ContextType.DEX,
      capabilities: [
        'market_data',
        'order_book',
        'price_streams',
        'trading'
      ],
      endpoint: 'https://api.binance.com',
      authRequired: true,
      schema: {
        marketData: {
          symbol: 'string',
          timeframe: 'string'
        },
        orderBookData: {
          symbol: 'string',
          depth: 'number'
        },
        placeOrder: {
          symbol: 'string',
          side: 'string',
          type: 'string',
          quantity: 'string',
          price: 'string'
        }
      }
    };
  }
  
  /**
   * Connect to Binance WebSocket for real-time data
   * @param symbol Symbol to subscribe to
   * @param stream Stream type (e.g., 'ticker', 'depth')
   * @param callback Callback function to handle data
   */
  connectToStream(symbol: string, stream: string, callback: (data: any) => void): void {
    const streamKey = `${symbol.toLowerCase()}@${stream}`;
    const wsEndpoint = `wss://stream.binance.com:9443/ws/${streamKey}`;
    
    console.log(`Connecting to Binance WebSocket: ${wsEndpoint}`);
    
    // Create WebSocket connection
    const ws = new WebSocket(wsEndpoint);
    
    // Setup event handlers
    ws.on('open', () => {
      console.log(`Connected to Binance stream for ${symbol} (${stream})`);
    });
    
    ws.on('message', (data: WebSocket.Data) => {
      try {
        const message = JSON.parse(data.toString());
        
        // Process different stream types
        if (stream === 'ticker') {
          this.handleTickerMessage(message);
        } else if (stream === 'depth') {
          this.handleOrderBookMessage(message);
        }
        
        // Call the callback with the received data
        callback(message);
        
        // Store callbacks for future use
        if (!this.callbacks.has(streamKey)) {
          this.callbacks.set(streamKey, []);
        }
        
        const callbacks = this.callbacks.get(streamKey)!;
        if (!callbacks.includes(callback)) {
          callbacks.push(callback);
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    });
    
    ws.on('error', (error) => {
      console.error(`WebSocket error for ${symbol} (${stream}):`, error);
      // Implement reconnection logic here
      this.reconnect(symbol, stream);
    });
    
    ws.on('close', () => {
      console.log(`WebSocket connection closed for ${symbol} (${stream})`);
      // Implement reconnection logic here
      this.reconnect(symbol, stream);
    });
    
    this.wsConnections.set(streamKey, ws);
  }
  
  /**
   * Reconnect to WebSocket after error or closure
   */
  private reconnect(symbol: string, stream: string): void {
    const streamKey = `${symbol.toLowerCase()}@${stream}`;
    setTimeout(() => {
      console.log(`Attempting to reconnect to ${streamKey}...`);
      
      // Get the stored callbacks
      const callbacks = this.callbacks.get(streamKey) || [];
      
      // Reconnect for each callback
      callbacks.forEach(callback => {
        this.connectToStream(symbol, stream, callback);
      });
    }, 5000); // Retry after 5 seconds
  }
  
  /**
   * Handle ticker message from WebSocket
   */
  private handleTickerMessage(message: any): void {
    const marketData: BinanceMarketData = {
      symbol: message.s,
      price: message.c,
      time: message.E
    };
    
    this.marketData.set(message.s, marketData);
  }
  
  /**
   * Handle order book message from WebSocket
   */
  private handleOrderBookMessage(message: any): void {
    const orderBookData: BinanceOrderBookData = {
      symbol: message.s,
      bids: message.b,
      asks: message.a,
      time: message.E
    };
    
    this.orderBooks.set(message.s, orderBookData);
  }
  
  /**
   * Get current price for a symbol
   * @param symbol Symbol to get price for
   * @returns Promise resolving to the current price
   */
  async getPrice(symbol: string): Promise<string> {
    try {
      // Try to use cached data if available
      if (this.marketData.has(symbol)) {
        return this.marketData.get(symbol)!.price;
      }
      
      // Otherwise fetch from REST API
      const response = await axios.get('https://api.binance.com/api/v3/ticker/price', {
        params: { symbol }
      });
      
      return response.data.price;
    } catch (error) {
      console.error(`Error fetching price for ${symbol}:`, error);
      throw new Error(`Failed to get price for ${symbol}`);
    }
  }
  
  /**
   * Get order book for a symbol
   * @param symbol Symbol to get order book for
   * @param depth Order book depth
   * @returns Promise resolving to the order book
   */
  async getOrderBook(symbol: string, depth: number = 20): Promise<BinanceOrderBookData> {
    try {
      // Try to use cached data if available
      if (this.orderBooks.has(symbol)) {
        return this.orderBooks.get(symbol)!;
      }
      
      // Otherwise fetch from REST API
      const response = await axios.get('https://api.binance.com/api/v3/depth', {
        params: { symbol, limit: depth }
      });
      
      return {
        symbol,
        bids: response.data.bids,
        asks: response.data.asks,
        time: Date.now()
      };
    } catch (error) {
      console.error(`Error fetching order book for ${symbol}:`, error);
      throw new Error(`Failed to get order book for ${symbol}`);
    }
  }
  
  /**
   * Get historical kline data (candlesticks)
   * @param symbol Symbol to get klines for
   * @param interval Kline interval (e.g., '1m', '1h', '1d')
   * @param limit Number of records to fetch
   * @returns Promise resolving to the klines
   */
  async getKlines(symbol: string, interval: string, limit: number = 100): Promise<any[]> {
    try {
      const response = await axios.get('https://api.binance.com/api/v3/klines', {
        params: { symbol, interval, limit }
      });
      
      return response.data;
    } catch (error) {
      console.error(`Error fetching klines for ${symbol}:`, error);
      throw new Error(`Failed to get klines for ${symbol}`);
    }
  }
  
  /**
   * Close all WebSocket connections
   */
  close(): void {
    for (const [key, ws] of this.wsConnections.entries()) {
      console.log(`Closing WebSocket connection for ${key}`);
      ws.close();
    }
    
    this.wsConnections.clear();
    this.callbacks.clear();
  }
}
