import { Connection, PublicKey } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { logger } from './utils/logger';

/**
 * Context definition interface matching the YAML/JSON format
 */
export interface ContextDefinition {
  id: string;
  name: string;
  description: string;
  type: ContextType;
  capabilities: string[];
  endpoint?: string;
  pubkey?: string;
  authRequired: boolean;
  schema?: Record<string, any>;
}

/**
 * Types of contexts that can be registered
 */
export enum ContextType {
  DEX = 'dex',
  NFT_MARKETPLACE = 'nft_marketplace',
  ORACLE = 'oracle',
  GOVERNANCE = 'governance',
  SOCIAL = 'social',
  IDENTITY = 'identity',
  STORAGE = 'storage'
}

/**
 * ContextManager handles the lifecycle of contexts, including loading, 
 * caching, and providing access to context metadata and services.
 */
export class ContextManager {
  private connection: Connection;
  private contexts: Map<string, ContextDefinition>;
  private contextPath: string;
  
  constructor(connection: Connection, contextPath: string) {
    this.connection = connection;
    this.contextPath = contextPath;
    this.contexts = new Map<string, ContextDefinition>();
    
    // Load contexts immediately
    this.loadContexts();
  }
  
  /**
   * Load all context definitions from files
   */
  private loadContexts(): void {
    try {
      if (!fs.existsSync(this.contextPath)) {
        logger.warn(`Context path ${this.contextPath} does not exist`);
        return;
      }
      
      const files = fs.readdirSync(this.contextPath);
      let loadedCount = 0;
      
      for (const file of files) {
        if (file.endsWith('.yaml') || file.endsWith('.yml') || file.endsWith('.json')) {
          const filePath = path.join(this.contextPath, file);
          const content = fs.readFileSync(filePath, 'utf8');
          
          let contextDef: ContextDefinition;
          
          if (file.endsWith('.json')) {
            contextDef = JSON.parse(content);
          } else {
            contextDef = yaml.parse(content);
          }
          
          this.contexts.set(contextDef.id, contextDef);
          loadedCount++;
        }
      }
      
      logger.info(`Loaded ${loadedCount} context definitions from ${this.contextPath}`);
    } catch (error) {
      logger.error('Failed to load context definitions:', error);
    }
  }
  
  /**
   * Get a context definition by ID
   * @param id The context ID
   * @returns The context definition or null if not found
   */
  getContext(id: string): ContextDefinition | null {
    return this.contexts.get(id) || null;
  }
  
  /**
   * Get all available contexts
   * @returns Array of all context definitions
   */
  getAllContexts(): ContextDefinition[] {
    return Array.from(this.contexts.values());
  }
  
  /**
   * Find contexts by type
   * @param type The context type to filter by
   * @returns Array of matching context definitions
   */
  getContextsByType(type: ContextType): ContextDefinition[] {
    return Array.from(this.contexts.values())
      .filter(context => context.type === type);
  }
  
  /**
   * Find contexts that match the requested capabilities
   * @param capabilities Array of capability strings to match
   * @returns Array of matching context definitions
   */
  findContextsByCapabilities(capabilities: string[]): ContextDefinition[] {
    const matches: ContextDefinition[] = [];
    
    for (const context of this.contexts.values()) {
      const hasAllCapabilities = capabilities.every(cap => 
        context.capabilities.some(contextCap => 
          contextCap.toLowerCase() === cap.toLowerCase()
        )
      );
      
      if (hasAllCapabilities) {
        matches.push(context);
      }
    }
    
    return matches;
  }
  
  /**
   * Register a new context in the registry
   * In a real implementation, this would create an on-chain record
   * @param contextDef The context definition to register
   * @param authority The authority that controls the context
   * @returns The public key of the new context
   */
  async registerContext(contextDef: ContextDefinition, authority: PublicKey): Promise<PublicKey | null> {
    try {
      // In a real implementation, this would call the registry program to register the context
      
      // For demonstration, we'll just generate a new keypair
      // This simulates the context's address/account being created on-chain
      const newContextId = new PublicKey('G6xptnrkj3Z3JegB3EqJPGqnVBKGLQXTqpEL9kHpMZN5');
      
      // Add to our local cache
      this.contexts.set(contextDef.id, contextDef);
      
      logger.info(`Registered new context: ${contextDef.name} (${contextDef.type}) with ID ${newContextId.toString()}`);
      
      return newContextId;
    } catch (error) {
      logger.error(`Error registering context ${contextDef.name}:`, error);
      return null;
    }
  }
  
  /**
   * Check if an agent has permission to access a specific context
   * @param agentId The agent's public key
   * @param contextId The context's ID
   * @returns Promise resolving to boolean indicating permission status
   */
  async checkPermission(agentId: PublicKey, contextId: string): Promise<boolean> {
    // In a real implementation, this would check on-chain permissions
    // using the registry program
    
    // For demonstration, we'll allow all access
    return true;
  }
}
