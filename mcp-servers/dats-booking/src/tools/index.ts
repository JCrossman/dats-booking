/**
 * Tool Registry
 *
 * Central registration point for all MCP tools.
 * Import and register all tool handlers here.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SessionManager } from '../auth/session-manager.js';
import type { CosmosSessionStore } from '../auth/cosmos-session-store.js';
import { createConnectAccountTool } from './connect-account.js';
import { createBookTripTool } from './book-trip.js';
import { createGetTripsTool } from './get-trips.js';
import { createTrackTripTool } from './track-trip.js';
import { createCancelTripTool } from './cancel-trip.js';
import { createCheckAvailabilityTool } from './check-availability.js';
import { createGetAnnouncementsTool } from './get-announcements.js';
import { createGetProfileTool } from './get-profile.js';
import { createGetInfoTool } from './get-info.js';
import { createDisconnectAccountTool } from './disconnect-account.js';
import { createCompleteConnectionTool } from './complete-connection.js';

export interface ToolDependencies {
  sessionManager: SessionManager;
  getCosmosStore: () => CosmosSessionStore;
  isRemoteMode: () => boolean;
  getValidSession: (sessionId?: string) => Promise<{ sessionCookie: string; clientId: string } | null>;
}

/**
 * Register all MCP tools with the server
 *
 * @param server - MCP server instance
 * @param deps - Shared dependencies for tools
 */
export function registerAllTools(server: McpServer, deps: ToolDependencies): void {
  // Register authentication tools
  createConnectAccountTool(deps).register(server);
  createCompleteConnectionTool(deps).register(server);
  createDisconnectAccountTool(deps).register(server);

  // Register booking tools
  createBookTripTool(deps).register(server);
  createGetTripsTool(deps).register(server);
  createTrackTripTool(deps).register(server);
  createCancelTripTool(deps).register(server);
  createCheckAvailabilityTool(deps).register(server);

  // Register informational tools
  createGetAnnouncementsTool(deps).register(server);
  createGetProfileTool(deps).register(server);
  createGetInfoTool().register(server);
}
