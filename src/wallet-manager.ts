import { Connection, PublicKey, Transaction, Keypair } from '@solana/web3.js';
import { Agent } from 'mcp-agents';
import { logger } from './utils/logger';

/**
 * Interface defining a wallet provider
 */
export interface WalletProvider {
  publicKey: PublicKey;
  signTransaction(transaction: Transaction): Promise<Transaction>;
  signAllTransactions(transactions: Transaction[]): Promise<Transaction[]>;
  connect(): Promise<{ publicKey: PublicKey }>;
  disconnect(): Promise<void>;
}

/**
 * WalletManager handles wallet connections and transaction signing
 * for agents interacting with the Solana blockchain
 */
export class WalletManager {
  private connection: Connection;
  private connectedWallets: Map<string, WalletProvider>;
  
  constructor(connection: Connection) {
    this.connection = connection;
    this.connectedWallets = new Map<string, WalletProvider>();
  }
  
  /**
   * Register a wallet provider for a specific public key
   * @param publicKey The wallet's public key
   * @param provider The wallet provider implementation
   */
  registerWallet(publicKey: PublicKey, provider: WalletProvider): void {
    const pubkeyStr = publicKey.toString();
    this.connectedWallets.set(pubkeyStr, provider);
    logger.info(`Wallet registered: ${pubkeyStr}`);
  }
  
  /**
   * Get a registered wallet provider
   * @param publicKey The wallet's public key
   * @returns The wallet provider or null if not found
   */
  getWallet(publicKey: PublicKey): WalletProvider | null {
    const pubkeyStr = publicKey.toString();
    return this.connectedWallets.get(pubkeyStr) || null;
  }
  
  /**
   * Remove a registered wallet provider
   * @param publicKey The wallet's public key
   */
  removeWallet(publicKey: PublicKey): void {
    const pubkeyStr = publicKey.toString();
    this.connectedWallets.delete(pubkeyStr);
    logger.info(`Wallet removed: ${pubkeyStr}`);
  }
  
  /**
   * Setup an agent to use a specific wallet for transaction signing
   * This is a placeholder method that would be implemented according
   * to the agent implementation details
   * @param agent The agent to setup
   * @param walletPublicKey The wallet's public key
   */
  async setupAgentForWallet(agent: Agent, walletPublicKey: PublicKey): Promise<boolean> {
    try {
      const wallet = this.getWallet(walletPublicKey);
      if (!wallet) {
        logger.warn(`Wallet ${walletPublicKey.toString()} not found`);
        return false;
      }
      
      // In a real implementation, this would configure the agent to use this wallet
      // The exact implementation depends on the agent interface
      
      logger.info(`Agent ${agent.getName()} set up with wallet ${walletPublicKey.toString()}`);
      return true;
    } catch (error) {
      logger.error(`Error setting up agent with wallet:`, error);
      return false;
    }
  }
  
  /**
   * Create a simple local wallet for testing purposes
   * This should only be used in development environments
   * @returns A wallet provider backed by a local keypair
   */
  createLocalWallet(): { publicKey: PublicKey, provider: WalletProvider } {
    const keypair = Keypair.generate();
    const publicKey = keypair.publicKey;
    
    const provider: WalletProvider = {
      publicKey,
      
      async signTransaction(transaction: Transaction): Promise<Transaction> {
        transaction.partialSign(keypair);
        return transaction;
      },
      
      async signAllTransactions(transactions: Transaction[]): Promise<Transaction[]> {
        return transactions.map(tx => {
          tx.partialSign(keypair);
          return tx;
        });
      },
      
      async connect(): Promise<{ publicKey: PublicKey }> {
        return { publicKey };
      },
      
      async disconnect(): Promise<void> {
        // Nothing to do for local wallets
      }
    };
    
    this.registerWallet(publicKey, provider);
    return { publicKey, provider };
  }
}
