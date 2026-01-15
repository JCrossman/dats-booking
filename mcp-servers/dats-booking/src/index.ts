#!/usr/bin/env node
/**
 * DATS Booking MCP Server
 *
 * Provides tools for booking Edmonton DATS trips via natural language.
 * Supports both local (stdio) and remote (HTTP) transport modes.
 *
 * SECURITY: Uses web-based authentication flow.
 * - Users enter credentials in a secure browser page
 * - Credentials NEVER touch Claude or Anthropic systems
 * - Only session cookies are stored (encrypted locally or in Cosmos DB)
 *
 * TRANSPORT MODES:
 * - stdio (default): Local mode for Claude Desktop, sessions stored locally
 * - http: Remote mode for Claude mobile/web, sessions stored in Cosmos DB
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { SessionManager } from './auth/session-manager.js';
import { createHttpServer, startHttpServer } from './server/http-server.js';
import { logger } from './utils/logger.js';
import { registerAllTools } from './tools/index.js';
import { isRemoteMode, getCosmosStore, getValidSession } from './helpers/session-helpers.js';

// ============= TRANSPORT MODE CONFIGURATION =============

/**
 * Transport mode: 'stdio' for local, 'http' for remote
 */
const TRANSPORT_MODE = (process.env.MCP_TRANSPORT || 'stdio') as 'stdio' | 'http';
const HTTP_PORT = parseInt(process.env.PORT || '3000', 10);
const HTTP_HOST = process.env.HOST || '0.0.0.0';

// ============= SERVER AND SESSION STORES =============

const server = new McpServer({
  name: 'dats-booking',
  version: '1.0.0',
});

// Local session manager (used in stdio mode)
const sessionManager = new SessionManager();

// ============= TOOL REGISTRATION =============

// Register all tools with shared dependencies
registerAllTools(server, {
  sessionManager,
  getCosmosStore: () => getCosmosStore(),
  isRemoteMode: () => isRemoteMode(TRANSPORT_MODE),
  getValidSession: (sessionId?: string) => getValidSession(sessionId, sessionManager, isRemoteMode(TRANSPORT_MODE)),
});

// ============= ALL TOOLS EXTRACTED =============
// All MCP tools have been extracted to modular files in src/tools/
// Each tool is registered via registerAllTools() above
// See src/tools/index.ts for the complete list

// ============= MAIN =============

/**
 * Start the MCP server in stdio mode (local, for Claude Desktop)
 */
async function startStdioServer(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info('DATS Booking MCP Server running on stdio');
  logger.info(`Session available: ${sessionManager.hasSession()}`);
}

/**
 * Start the MCP server in HTTP mode (remote, for Claude mobile/web)
 */
async function startRemoteServer(): Promise<void> {
  logger.info('Starting DATS Booking MCP Server in HTTP mode');

  const app = createHttpServer(server);
  await startHttpServer(app, HTTP_PORT, HTTP_HOST);
}

/**
 * Main entry point - starts appropriate server based on transport mode
 */
async function main(): Promise<void> {
  logger.info(`Transport mode: ${TRANSPORT_MODE}`);

  if (TRANSPORT_MODE === 'http') {
    await startRemoteServer();
  } else {
    await startStdioServer();
  }
}

main().catch((error) => {
  logger.error('Fatal error', error instanceof Error ? error : undefined);
  process.exit(1);
});
