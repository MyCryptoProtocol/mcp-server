import { Router } from 'express';
import { Connection, PublicKey } from '@solana/web3.js';
import { AgentManager } from '../agent-manager';
import { ContextManager } from '../context-manager';
import { WalletManager } from '../wallet-manager';
import { logger } from '../utils/logger';

export function api(
  connection: Connection,
  agentManager: AgentManager,
  contextManager: ContextManager,
  walletManager: WalletManager
): Router {
  const router = Router();
  
  // Middleware for API request logging
  router.use((req, res, next) => {
    logger.info(`API Request: ${req.method} ${req.path}`);
    next();
  });
  
  // Health check endpoint
  router.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });
  
  // Get all contexts
  router.get('/contexts', (req, res) => {
    const contexts = contextManager.getAllContexts();
    res.json(contexts);
  });
  
  // Get contexts by type
  router.get('/contexts/type/:type', (req, res) => {
    const { type } = req.params;
    try {
      const contexts = contextManager.getContextsByType(type as any);
      res.json(contexts);
    } catch (error) {
      res.status(400).json({ error: 'Invalid context type' });
    }
  });
  
  // Get context by ID
  router.get('/contexts/:id', (req, res) => {
    const { id } = req.params;
    const context = contextManager.getContext(id);
    
    if (!context) {
      return res.status(404).json({ error: 'Context not found' });
    }
    
    res.json(context);
  });
  
  // Register a new agent
  router.post('/agents/register', async (req, res) => {
    const { name, type, authority } = req.body;
    
    if (!name || !type || !authority) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    try {
      const authorityPubkey = new PublicKey(authority);
      const agentId = await agentManager.registerAgent(name, type, authorityPubkey);
      
      if (!agentId) {
        return res.status(500).json({ error: 'Failed to register agent' });
      }
      
      res.json({
        success: true,
        agentId: agentId.toString(),
        name,
        type
      });
    } catch (error) {
      logger.error('Error registering agent:', error);
      res.status(500).json({ error: 'Failed to register agent' });
    }
  });
  
  // Process agent instruction
  router.post('/agents/:id/process', async (req, res) => {
    const { id } = req.params;
    const { instruction, walletAddress } = req.body;
    
    if (!instruction) {
      return res.status(400).json({ error: 'Missing instruction' });
    }
    
    try {
      const agentPubkey = new PublicKey(id);
      const agent = await agentManager.getAgent(agentPubkey);
      
      if (!agent) {
        return res.status(404).json({ error: 'Agent not found' });
      }
      
      // If wallet address provided, set it up for the agent
      if (walletAddress) {
        await walletManager.setupAgentForWallet(agent, new PublicKey(walletAddress));
      }
      
      // Process the instruction
      const result = await agent.processInstruction(instruction);
      res.json(result);
    } catch (error) {
      logger.error(`Error processing instruction for agent ${id}:`, error);
      res.status(500).json({ 
        error: 'Failed to process instruction',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  // Create local test wallet (development only)
  router.post('/wallets/local', (req, res) => {
    try {
      const { publicKey, provider } = walletManager.createLocalWallet();
      res.json({
        success: true,
        publicKey: publicKey.toString()
      });
    } catch (error) {
      logger.error('Error creating local wallet:', error);
      res.status(500).json({ error: 'Failed to create local wallet' });
    }
  });

  return router;
}
