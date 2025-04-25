import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { Agent } from 'mcp-agents';
import { AgentManager } from '../src/agent-manager';
import { ContextManager } from '../src/context-manager';

// Mock the Agent classes
jest.mock('mcp-agents/src/agents/solana-defi-agent', () => {
  return {
    SolanaDeFiAgent: jest.fn().mockImplementation(() => {
      return {
        getName: () => 'Solana DeFi Agent',
        getDescription: () => 'A test DeFi agent',
        getCapabilities: () => ['Token Swaps', 'Liquidity Provision'],
        processInstruction: jest.fn().mockResolvedValue({
          success: true,
          message: 'Instruction processed successfully',
          data: { result: 'test-result' }
        }),
        executeTransaction: jest.fn().mockResolvedValue('test-signature'),
        getState: jest.fn().mockResolvedValue({
          agentId: 'test-agent-id',
          supportedDexes: ['Jupiter', 'Raydium']
        })
      };
    })
  };
});

jest.mock('mcp-agents/src/agents/nft-market-agent', () => {
  return {
    NFTMarketAgent: jest.fn().mockImplementation(() => {
      return {
        getName: () => 'Solana NFT Market Agent',
        getDescription: () => 'A test NFT agent',
        getCapabilities: () => ['NFT Listing', 'NFT Buying'],
        processInstruction: jest.fn().mockResolvedValue({
          success: true,
          message: 'Instruction processed successfully',
          data: { result: 'test-result' }
        }),
        executeTransaction: jest.fn().mockResolvedValue('test-signature'),
        getState: jest.fn().mockResolvedValue({
          agentId: 'test-agent-id',
          supportedMarketplaces: ['Magic Eden', 'Tensor']
        })
      };
    })
  };
});

describe('AgentManager', () => {
  let agentManager: AgentManager;
  let mockConnection: Connection;
  let mockContextManager: ContextManager;

  beforeEach(() => {
    // Create mock objects
    mockConnection = {} as Connection;
    mockContextManager = {
      getContext: jest.fn(),
      getAllContexts: jest.fn(),
      getContextsByType: jest.fn(),
      findContextsByCapabilities: jest.fn(),
      registerContext: jest.fn(),
      checkPermission: jest.fn()
    } as unknown as ContextManager;

    // Create AgentManager instance
    agentManager = new AgentManager(mockConnection, mockContextManager);

    // Mock the getAgentType method to return known types for testing
    jest.spyOn<any, any>(agentManager, 'getAgentType').mockImplementation((agentId: PublicKey) => {
      const id = agentId.toString();
      if (id.startsWith('defi')) {
        return Promise.resolve('defi');
      } else if (id.startsWith('nft')) {
        return Promise.resolve('nft');
      } else {
        // For testing unknown types
        return Promise.resolve('unknown');
      }
    });
  });

  describe('getAgent', () => {
    it('should create a DeFi agent when agent type is defi', async () => {
      // Create a public key that will result in 'defi' type
      const agentId = new PublicKey('defiXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');
      
      const agent = await agentManager.getAgent(agentId);
      
      expect(agent).not.toBeNull();
      expect(agent?.getName()).toBe('Solana DeFi Agent');
      expect(agent?.getCapabilities()).toContain('Token Swaps');
    });

    it('should create an NFT agent when agent type is nft', async () => {
      // Create a public key that will result in 'nft' type
      const agentId = new PublicKey('nftXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');
      
      const agent = await agentManager.getAgent(agentId);
      
      expect(agent).not.toBeNull();
      expect(agent?.getName()).toBe('Solana NFT Market Agent');
      expect(agent?.getCapabilities()).toContain('NFT Listing');
    });

    it('should return null for unknown agent types', async () => {
      // Create a public key that will result in 'unknown' type
      const agentId = new PublicKey('unknownXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');
      
      const agent = await agentManager.getAgent(agentId);
      
      expect(agent).toBeNull();
    });

    it('should return the same agent instance for repeated requests', async () => {
      const agentId = new PublicKey('defiXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');
      
      const agent1 = await agentManager.getAgent(agentId);
      const agent2 = await agentManager.getAgent(agentId);
      
      expect(agent1).toBe(agent2); // Should be the same instance
    });
  });

  describe('registerAgent', () => {
    it('should register a new agent and return its ID', async () => {
      const authority = Keypair.generate().publicKey;
      const name = 'Test Agent';
      const type = 'defi';
      
      const agentId = await agentManager.registerAgent(name, type, authority);
      
      expect(agentId).not.toBeNull();
      expect(agentId?.toString()).toBeDefined();
    });
  });
});
