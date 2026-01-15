/**
 * Tool Registry
 *
 * Central registration point for all MCP tools.
 * Import and register all tool handlers here.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// Tool imports will be added here as we extract them
// import { connectAccountTool } from './connect-account.js';
// import { bookTripTool } from './book-trip.js';
// import { getTripsTool } from './get-trips.js';
// ... etc

/**
 * Register all MCP tools with the server
 *
 * @param _server - MCP server instance (tools will be registered here)
 */
export function registerAllTools(_server: McpServer): void {
  // Tools will be registered here as they are extracted
  // connectAccountTool.register(server);
  // bookTripTool.register(server);
  // getTripsTool.register(server);
  // ... etc
}
