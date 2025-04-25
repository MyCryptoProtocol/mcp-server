import { Request, Response } from 'express';
import { Connection, PublicKey } from '@solana/web3.js';
import { AgentManager } from '../src/agent-manager';
import { ContextManager, ContextType } from '../src/context-manager';
import { WalletManager } from '../src/wallet-manager';
import { api } from '../src/api';

// Mock Express router
const mockRouter = {
  use: jest.fn(),
  get: jest.fn(),
  post: jest.fn()
};

// Mock Express
jest.mock('express', () => ({
  Router: jest.fn().mockImplementation(() => mockRouter)
}));

describe('API', () => {
  let mockConnection: Connection;
  let mockAgentManager: AgentManager;
  let mockContextManager: ContextManager;
  let mockWalletManager: WalletManager;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock objects
    mockConnection = {} as Connection;
    
    mockAgentManager = {
      getAgent: jest.fn().mockResolvedValue({
        getName: () => 'Test Agent',
        getCapabilities: () => ['test_capability'],
        processInstruction: jest.fn().mockResolvedValue({
          success: true,
          message: 'Instruction processed',
          data: { result: 'test' }
        })
      }),
      registerAgent: jest.fn().mockResolvedValue(new PublicKey('3Xm6F4v3UKqZphALNuMpMEKRvRqQhBiN7DUBwihMTmup'))
    } as unknown as AgentManager;
    
    mockContextManager = {
      getContext: jest.fn().mockImplementation((id) => {
        if (id === 'test-context') {
          return {
            id: 'test-context',
            name: 'Test Context',
            type: ContextType.DEX,
            capabilities: ['test_capability']
          };
        }
        return null;
      }),
      getAllContexts: jest.fn().mockReturnValue([
        {
          id: 'test-context-1',
          name: 'Test Context 1',
          type: ContextType.DEX,
          capabilities: ['token_swaps']
        },
        {
          id: 'test-context-2',
          name: 'Test Context 2',
          type: ContextType.NFT_MARKETPLACE,
          capabilities: ['nft_listing']
        }
      ]),
      getContextsByType: jest.fn().mockImplementation((type) => {
        if (type === ContextType.DEX) {
          return [{
            id: 'test-context-1',
            name: 'Test Context 1',
            type: ContextType.DEX,
            capabilities: ['token_swaps']
          }];
        }
        return [];
      })
    } as unknown as ContextManager;
    
    mockWalletManager = {
      setupAgentForWallet: jest.fn().mockResolvedValue(true),
      createLocalWallet: jest.fn().mockReturnValue({
        publicKey: new PublicKey('3Xm6F4v3UKqZphALNuMpMEKRvRqQhBiN7DUBwihMTmup'),
        provider: {}
      })
    } as unknown as WalletManager;
    
    // Initialize API
    api(mockConnection, mockAgentManager, mockContextManager, mockWalletManager);
  });

  it('should set up middleware and routes', () => {
    expect(mockRouter.use).toHaveBeenCalled();
    expect(mockRouter.get).toHaveBeenCalledWith('/health', expect.any(Function));
    expect(mockRouter.get).toHaveBeenCalledWith('/contexts', expect.any(Function));
    expect(mockRouter.get).toHaveBeenCalledWith('/contexts/type/:type', expect.any(Function));
    expect(mockRouter.get).toHaveBeenCalledWith('/contexts/:id', expect.any(Function));
    expect(mockRouter.post).toHaveBeenCalledWith('/agents/register', expect.any(Function));
    expect(mockRouter.post).toHaveBeenCalledWith('/agents/:id/process', expect.any(Function));
    expect(mockRouter.post).toHaveBeenCalledWith('/wallets/local', expect.any(Function));
  });

  describe('GET /health', () => {
    it('should return health status', () => {
      // Find the health route handler
      const healthHandler = mockRouter.get.mock.calls.find(call => call[0] === '/health')?.[1];
      expect(healthHandler).toBeDefined();
      
      // Mock req and res
      const req = {} as Request;
      const res = {
        json: jest.fn()
      } as unknown as Response;
      
      // Call the handler
      healthHandler(req, res);
      
      // Check response
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        status: 'ok',
        timestamp: expect.any(String)
      }));
    });
  });

  describe('GET /contexts', () => {
    it('should return all contexts', () => {
      // Find the contexts route handler
      const contextsHandler = mockRouter.get.mock.calls.find(call => call[0] === '/contexts')?.[1];
      expect(contextsHandler).toBeDefined();
      
      // Mock req and res
      const req = {} as Request;
      const res = {
        json: jest.fn()
      } as unknown as Response;
      
      // Call the handler
      contextsHandler(req, res);
      
      // Check response
      expect(res.json).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({ id: 'test-context-1' }),
        expect.objectContaining({ id: 'test-context-2' })
      ]));
    });
  });

  describe('GET /contexts/type/:type', () => {
    it('should return contexts filtered by type', () => {
      // Find the contexts by type route handler
      const typeHandler = mockRouter.get.mock.calls.find(call => call[0] === '/contexts/type/:type')?.[1];
      expect(typeHandler).toBeDefined();
      
      // Mock req and res
      const req = {
        params: { type: 'dex' }
      } as unknown as Request;
      const res = {
        json: jest.fn()
      } as unknown as Response;
      
      // Call the handler
      typeHandler(req, res);
      
      // Check response
      expect(mockContextManager.getContextsByType).toHaveBeenCalledWith('dex');
      expect(res.json).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({ id: 'test-context-1' })
      ]));
    });
  });

  describe('GET /contexts/:id', () => {
    it('should return a context by ID', () => {
      // Find the context by ID route handler
      const idHandler = mockRouter.get.mock.calls.find(call => call[0] === '/contexts/:id')?.[1];
      expect(idHandler).toBeDefined();
      
      // Mock req and res
      const req = {
        params: { id: 'test-context' }
      } as unknown as Request;
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      } as unknown as Response;
      
      // Call the handler
      idHandler(req, res);
      
      // Check response
      expect(mockContextManager.getContext).toHaveBeenCalledWith('test-context');
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        id: 'test-context',
        name: 'Test Context'
      }));
    });
    
    it('should return 404 for non-existent context', () => {
      // Find the context by ID route handler
      const idHandler = mockRouter.get.mock.calls.find(call => call[0] === '/contexts/:id')?.[1];
      expect(idHandler).toBeDefined();
      
      // Mock req and res
      const req = {
        params: { id: 'non-existent' }
      } as unknown as Request;
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      } as unknown as Response;
      
      // Call the handler
      idHandler(req, res);
      
      // Check response
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.any(String)
      }));
    });
  });

  describe('POST /agents/register', () => {
    it('should register a new agent', async () => {
      // Find the register agent route handler
      const registerHandler = mockRouter.post.mock.calls.find(call => call[0] === '/agents/register')?.[1];
      expect(registerHandler).toBeDefined();
      
      // Mock req and res
      const req = {
        body: {
          name: 'Test Agent',
          type: 'defi',
          authority: '3Xm6F4v3UKqZphALNuMpMEKRvRqQhBiN7DUBwihMTmup'
        }
      } as unknown as Request;
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      } as unknown as Response;
      
      // Call the handler
      await registerHandler(req, res);
      
      // Check response
      expect(mockAgentManager.registerAgent).toHaveBeenCalledWith(
        'Test Agent',
        'defi',
        expect.any(PublicKey)
      );
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        agentId: expect.any(String),
        name: 'Test Agent',
        type: 'defi'
      }));
    });
  });
});
