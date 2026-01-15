/**
 * disconnect_account Tool
 *
 * Logs out of DATS account and clears session.
 * Handles both local (file-based) and remote (Cosmos DB) sessions.
 *
 * SECURITY: Clears encrypted session data.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SessionManager } from '../auth/session-manager.js';
import type { CosmosSessionStore } from '../auth/cosmos-session-store.js';
import { ErrorCategory } from '../types.js';
import { wrapError, createErrorResponse } from '../utils/errors.js';
import type { ToolRegistration } from './types.js';

export interface DisconnectAccountDependencies {
  sessionManager: SessionManager;
  getCosmosStore: () => CosmosSessionStore;
  isRemoteMode: () => boolean;
}

export function createDisconnectAccountTool(deps: DisconnectAccountDependencies): ToolRegistration {
  return {
    register(server: McpServer) {
      server.tool(
        'disconnect_account',
        `Log out of your DATS account and clear your session.

Use this tool when:
- You want to log out for security reasons
- You want to switch to a different DATS account
- You are done using DATS booking

After disconnecting, you will need to use connect_account to log in again.

REMOTE MODE: Include session_id to disconnect a specific session.`,
        {
          session_id: z
            .string()
            .uuid()
            .optional()
            .describe('Session ID to disconnect (required for remote mode)'),
        },
        async ({ session_id }) => {
          try {
            // Remote mode: delete from Cosmos DB
            if (deps.isRemoteMode()) {
              if (!session_id) {
                return createErrorResponse({
                  category: ErrorCategory.VALIDATION_ERROR,
                  message: 'session_id is required to disconnect in remote mode.',
                  recoverable: true,
                });
              }

              const hadSession = await deps.getCosmosStore().hasSession(session_id);
              await deps.getCosmosStore().delete(session_id);

              return {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(
                      {
                        success: true,
                        message: hadSession
                          ? 'You have been logged out. Your session has been cleared. To use DATS booking again, you will need to connect your account.'
                          : 'Session not found or already expired.',
                      },
                      null,
                      2
                    ),
                  },
                ],
              };
            }

            // Local mode: clear file-based session
            const hadSession = deps.sessionManager.hasSession();
            await deps.sessionManager.clear();

            if (hadSession) {
              return {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(
                      {
                        success: true,
                        message:
                          'You have been logged out. Your session has been cleared from this computer. To use DATS booking again, you will need to connect your account.',
                      },
                      null,
                      2
                    ),
                  },
                ],
              };
            } else {
              return {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(
                      {
                        success: true,
                        message: 'You were not logged in. No session to clear.',
                      },
                      null,
                      2
                    ),
                  },
                ],
              };
            }
          } catch (error) {
            const datsError = wrapError(error);
            return createErrorResponse(datsError.toToolError());
          }
        }
      );
    },
  };
}
