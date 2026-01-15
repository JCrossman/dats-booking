/**
 * get_announcements Tool
 *
 * Gets DATS system announcements and important notices.
 *
 * SECURITY: Requires valid session from connect_account.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SessionManager } from '../auth/session-manager.js';
import type { CosmosSessionStore } from '../auth/cosmos-session-store.js';
import { DATSApi } from '../api/dats-api.js';
import { ErrorCategory } from '../types.js';
import { wrapError, createErrorResponse } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import type { ToolRegistration } from './types.js';

export interface GetAnnouncementsDependencies {
  sessionManager: SessionManager;
  getCosmosStore: () => CosmosSessionStore;
  isRemoteMode: () => boolean;
  getValidSession: (sessionId?: string) => Promise<{ sessionCookie: string; clientId: string } | null>;
}

export function createGetAnnouncementsTool(deps: GetAnnouncementsDependencies): ToolRegistration {
  return {
    register(server: McpServer) {
      server.tool(
        'get_announcements',
        `Get DATS system announcements and important notices for clients.

REMOTE MODE: Include session_id from connect_account/complete_connection.`,
        {
          session_id: z
            .string()
            .uuid()
            .optional()
            .describe('Session ID (required for remote mode, optional for local)'),
        },
        async ({ session_id }) => {
          try {
            // Check for valid session
            const session = await deps.getValidSession(session_id);
            if (!session) {
              return createErrorResponse({
                category: ErrorCategory.CREDENTIALS_NOT_FOUND,
                message:
                  'Your session has expired or you have not connected your DATS account yet. Would you like me to open the secure login page? (Use the connect_account tool)',
                recoverable: true,
              });
            }

            logger.info('Fetching DATS announcements');
            const api = new DATSApi({ sessionCookie: session.sessionCookie });
            const announcements = await api.getAnnouncements();

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ success: true, announcements }, null, 2),
                },
              ],
            };
          } catch (error) {
            const datsError = wrapError(error);
            return createErrorResponse(datsError.toToolError());
          }
        }
      );
    },
  };
}
