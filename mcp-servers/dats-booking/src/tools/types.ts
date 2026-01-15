/**
 * Tool Type Definitions
 *
 * Shared types and utilities for MCP tool handlers.
 * Each tool implements the ToolDefinition interface and uses
 * the registerTool helper for consistent registration.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * Standard tool response format
 */
export interface ToolResponse {
  content: Array<{ type: 'text'; text: string }>;
}

/**
 * Tool registration object
 * Each tool exports an object with a register() method
 */
export interface ToolRegistration {
  register(server: McpServer): void;
}
