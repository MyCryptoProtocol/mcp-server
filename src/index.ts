import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';
import { AgentManager } from './agent-manager';
import { ContextManager } from './context-manager';
import { WalletManager } from './wallet-manager';
import { logger } from './utils/logger';
import { api } from './api';
import { config } from './config';

// Create Express application
const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Initialize Solana connection
const connection = new Connection(
  config.solana.rpcUrl || clusterApiUrl(config.solana.cluster || 'devnet'),
  config.solana.commitment || 'confirmed'
);

// Initialize managers
const walletManager = new WalletManager(connection);
const contextManager = new ContextManager(connection, config.contextPath);
const agentManager = new AgentManager(connection, contextManager);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// API routes
app.use('/api', api(connection, agentManager, contextManager, walletManager));

// WebSocket handling
io.on('connection', (socket) => {
  logger.info(`New client connected: ${socket.id}`);
  
  socket.on('agentInstruction', async (data) => {
    try {
      const { agentId, instruction, walletAddress } = data;
      
      if (!agentId || !instruction) {
        socket.emit('error', { message: 'Missing agentId or instruction' });
        return;
      }
      
      logger.info(`Processing instruction for agent ${agentId}: ${instruction}`);
      
      // Process the instruction through the agent manager
      const agent = await agentManager.getAgent(new PublicKey(agentId));
      if (!agent) {
        socket.emit('error', { message: `Agent ${agentId} not found` });
        return;
      }
      
      // If wallet address is provided, set the wallet for the agent
      if (walletAddress) {
        await walletManager.setupAgentForWallet(agent, new PublicKey(walletAddress));
      }
      
      // Process the instruction and emit the result
      const result = await agent.processInstruction(instruction);
      socket.emit('agentResponse', result);
      
    } catch (error) {
      logger.error('Error processing agent instruction:', error);
      socket.emit('error', { 
        message: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });
  
  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Start the server
const PORT = config.server.port || 3000;
server.listen(PORT, () => {
  logger.info(`MCP Server running on port ${PORT}`);
  logger.info(`Solana connection: ${config.solana.rpcUrl || clusterApiUrl(config.solana.cluster || 'devnet')}`);
  logger.info(`Environment: ${config.env}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});
