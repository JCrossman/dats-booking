/**
 * disconnect_account Tool
 *
 * Logs out of DATS account and clears session.
 * Handles both local (file-based) and remote (Cosmos DB) sessions.
 *
 * SECURITY: Clears encrypted session data.
 * POPA COMPLIANCE: Provides user right to delete data before 24-hour TTL.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SessionManager } from '../auth/session-manager.js';
import type { CosmosSessionStore } from '../auth/cosmos-session-store.js';
import { ErrorCategory } from '../types.js';
import { wrapError, createErrorResponse } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import type { ToolRegistration } from './types.js';
import crypto from 'crypto';

export interface DisconnectAccountDependencies {
  sessionManager: SessionManager;
  getCosmosStore: () => CosmosSessionStore;
  isRemoteMode: () => boolean;
}

/**
 * Hash session ID for audit logging (prevents PII in logs)
 */
function hashSessionId(sessionId: string): string {
  return crypto.createHash('sha256').update(sessionId).digest('hex').substring(0, 16);
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
- You want to delete your data before the 24-hour automatic expiration (POPA right to erasure)

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

              // Audit log: Session deletion (POPA compliance)
              logger.audit({
                action: 'session_deleted',
                result: 'success',
                sessionIdHash: hashSessionId(session_id),
              });

              return {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(
                      {
                        success: true,
                        message: hadSession
                          ? 'You have been logged out. Your session has been permanently deleted from Azure. To use DATS booking again, you will need to connect your account.'
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

            // Audit log: Local session deletion
            logger.audit({
              action: 'local_session_deleted',
              result: 'success',
            });

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
            logger.audit({
              action: 'session_deletion_failed',
              result: 'failure',
              errorCode: datsError.category,
              sessionIdHash: session_id ? hashSessionId(session_id) : undefined,
            });
            return createErrorResponse(datsError.toToolError());
          }
        }
      );
    },
  };
}
