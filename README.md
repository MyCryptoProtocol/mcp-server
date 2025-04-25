# MCP Server

## Overview
Reference server implementation for the Machine-Centric Protocol (MCP) on Solana. This server handles context metadata, wallet integration, and bridges between agents and off-chain services.

## Features
- **Context Metadata**: Loading and caching of context definitions
- **Wallet Integration**: Support for Solana wallets (Phantom, Backpack, etc.)
- **Agent Bridge**: Connection layer between agents and off-chain services
- **API Endpoints**: RESTful and WebSocket interfaces for agent communication

## Development Setup
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test
```

## Repository Structure
- `/src` - Server implementation including API routes and service integrations
- `/tests` - Unit and integration tests
- `/.github` - CI/CD workflows

## Links
- [Documentation](../mcp-docs)
- [Core Protocol](../mcp-core)
- [Agents](../mcp-agents)
- [Examples](../mcp-examples)
