import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { ContextManager, ContextType } from '../src/context-manager';
import * as fs from 'fs';
import * as path from 'path';

// Mock the fs module
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  readdirSync: jest.fn().mockReturnValue(['jupiter-dex.yaml', 'magiceden-marketplace.yaml', 'test.txt']),
  readFileSync: jest.fn().mockImplementation((filePath) => {
    if (filePath.includes('jupiter-dex.yaml')) {
      return `
id: jupiter-dex-v4
name: Jupiter Aggregator
description: A liquidity aggregator for Solana
type: dex
capabilities:
  - token_swaps
  - route_optimization
endpoint: https://quote-api.jup.ag/v4
authRequired: false
      `;
    } else if (filePath.includes('magiceden-marketplace.yaml')) {
      return `
id: magiceden-v2
name: Magic Eden NFT Marketplace
description: NFT marketplace on Solana
type: nft_marketplace
capabilities:
  - nft_listing
  - nft_buying
endpoint: https://api-mainnet.magiceden.io/v2
authRequired: false
      `;
    }
    return '';
  })
}));

// Mock the yaml module
jest.mock('yaml', () => ({
  parse: jest.fn().mockImplementation((content) => {
    if (content.includes('jupiter')) {
      return {
        id: 'jupiter-dex-v4',
        name: 'Jupiter Aggregator',
        description: 'A liquidity aggregator for Solana',
        type: 'dex',
        capabilities: ['token_swaps', 'route_optimization'],
        endpoint: 'https://quote-api.jup.ag/v4',
        authRequired: false
      };
    } else if (content.includes('magiceden')) {
      return {
        id: 'magiceden-v2',
        name: 'Magic Eden NFT Marketplace',
        description: 'NFT marketplace on Solana',
        type: 'nft_marketplace',
        capabilities: ['nft_listing', 'nft_buying'],
        endpoint: 'https://api-mainnet.magiceden.io/v2',
        authRequired: false
      };
    }
    return {};
  })
}));

describe('ContextManager', () => {
  let contextManager: ContextManager;
  let mockConnection: Connection;

  beforeEach(() => {
    mockConnection = {} as Connection;
    contextManager = new ContextManager(mockConnection, '/path/to/contexts');
  });

  describe('Context loading', () => {
    it('should load context definitions from files', () => {
      // This is automatically called in the constructor
      expect(fs.existsSync).toHaveBeenCalledWith('/path/to/contexts');
      expect(fs.readdirSync).toHaveBeenCalledWith('/path/to/contexts');
      expect(fs.readFileSync).toHaveBeenCalledTimes(2);
    });
  });

  describe('getContext', () => {
    it('should return a context definition by ID', () => {
      const context = contextManager.getContext('jupiter-dex-v4');
      
      expect(context).not.toBeNull();
      expect(context?.name).toBe('Jupiter Aggregator');
      expect(context?.type).toBe('dex');
    });

    it('should return null for non-existent contexts', () => {
      const context = contextManager.getContext('non-existent');
      expect(context).toBeNull();
    });
  });

  describe('getAllContexts', () => {
    it('should return all loaded contexts', () => {
      const contexts = contextManager.getAllContexts();
      
      expect(contexts.length).toBe(2);
      expect(contexts[0].id).toBe('jupiter-dex-v4');
      expect(contexts[1].id).toBe('magiceden-v2');
    });
  });

  describe('getContextsByType', () => {
    it('should return contexts filtered by type', () => {
      const dexContexts = contextManager.getContextsByType(ContextType.DEX);
      const nftContexts = contextManager.getContextsByType(ContextType.NFT_MARKETPLACE);
      
      expect(dexContexts.length).toBe(1);
      expect(dexContexts[0].id).toBe('jupiter-dex-v4');
      
      expect(nftContexts.length).toBe(1);
      expect(nftContexts[0].id).toBe('magiceden-v2');
    });

    it('should return empty array for non-existent types', () => {
      const oracleContexts = contextManager.getContextsByType(ContextType.ORACLE);
      expect(oracleContexts.length).toBe(0);
    });
  });

  describe('findContextsByCapabilities', () => {
    it('should find contexts that match all requested capabilities', () => {
      const swapContexts = contextManager.findContextsByCapabilities(['token_swaps']);
      
      expect(swapContexts.length).toBe(1);
      expect(swapContexts[0].id).toBe('jupiter-dex-v4');
    });

    it('should return empty array when no contexts match capabilities', () => {
      const contexts = contextManager.findContextsByCapabilities(['non_existent_capability']);
      expect(contexts.length).toBe(0);
    });
  });

  describe('registerContext', () => {
    it('should register a new context and return its ID', async () => {
      const authority = Keypair.generate().publicKey;
      const contextDef = {
        id: 'test-context',
        name: 'Test Context',
        description: 'A test context',
        type: ContextType.ORACLE,
        capabilities: ['price_feed'],
        authRequired: false
      };
      
      const contextId = await contextManager.registerContext(contextDef, authority);
      
      expect(contextId).not.toBeNull();
      
      // The context should now be available via getContext
      const registeredContext = contextManager.getContext('test-context');
      expect(registeredContext).not.toBeNull();
      expect(registeredContext?.name).toBe('Test Context');
    });
  });

  describe('checkPermission', () => {
    it('should check if an agent has permission to access a context', async () => {
      const agentId = Keypair.generate().publicKey;
      const hasPermission = await contextManager.checkPermission(agentId, 'jupiter-dex-v4');
      
      // In our mock implementation, this always returns true
      expect(hasPermission).toBe(true);
    });
  });
});
