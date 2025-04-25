/**
 * Configuration for the MCP Server
 */
export const config = {
  env: process.env.NODE_ENV || 'development',
  
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || 'localhost'
  },
  
  solana: {
    rpcUrl: process.env.SOLANA_RPC_URL,
    cluster: process.env.SOLANA_CLUSTER || 'devnet',
    commitment: process.env.SOLANA_COMMITMENT || 'confirmed'
  },
  
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    enabled: process.env.REDIS_ENABLED === 'true' || false
  },
  
  contextPath: process.env.CONTEXT_PATH || '../mcp-agents/contexts',
  
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json'
  },
  
  security: {
    jwtSecret: process.env.JWT_SECRET || 'development-secret-do-not-use-in-production',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d'
  },
  
  // Optional: OpenAI for enhanced instruction parsing
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    enabled: process.env.OPENAI_ENABLED === 'true' || false
  }
};
