/**
 * complete_connection Tool
 *
 * Completes connection process after browser authentication (remote mode only).
 * Usually not needed - connect_account now polls automatically in background.
 *
 * SECURITY: Stores session in Cosmos DB after validation.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { CosmosSessionStore } from '../auth/cosmos-session-store.js';
import { pollAuthResultRemote } from '../auth/web-auth.js';
import { ErrorCategory } from '../types.js';
import { wrapError, createErrorResponse } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import type { ToolRegistration } from './types.js';

export interface CompleteConnectionDependencies {
  getCosmosStore: () => CosmosSessionStore;
  isRemoteMode: () => boolean;
}

export function createCompleteConnectionTool(deps: CompleteConnectionDependencies): ToolRegistration {
  return {
    register(server: McpServer) {
      server.tool(
        'complete_connection',
        `Complete the connection process after authenticating in your browser.

REMOTE MODE ONLY: This tool is usually NOT needed - connect_account now polls automatically in the background.
Only use this if the automatic polling timed out or you need to manually complete an old session.`,
        {
          session_id: z
            .string()
            .uuid()
            .describe('The session_id returned by connect_account'),
        },
        async ({ session_id }) => {
          try {
            // This tool only makes sense in remote mode, but handle gracefully
            if (!deps.isRemoteMode()) {
              return {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(
                      {
                        success: false,
                        message:
                          'This tool is only needed in remote mode. In local mode, connect_account handles everything.',
                      },
                      null,
                      2
                    ),
                  },
                ],
              };
            }

            logger.info(`Completing connection for session: ${session_id.substring(0, 8)}...`);

            // Poll for authentication result
            const result = await pollAuthResultRemote(session_id);

            if (!result.success || !result.sessionCookie || !result.clientId) {
              return createErrorResponse({
                category: ErrorCategory.AUTH_FAILURE,
                message: result.error || 'Authentication did not complete. Please try again.',
                recoverable: true,
              });
            }

            // Store in Cosmos DB
            await deps.getCosmosStore().store(session_id, {
              sessionCookie: result.sessionCookie,
              clientId: result.clientId,
              createdAt: new Date().toISOString(),
            });

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    {
                      success: true,
                      sessionId: session_id,
                      message:
                        'Your DATS account is connected! You can now book trips, view upcoming trips, and more. ' +
                        'Include the session_id in future requests to stay connected.',
                    },
                    null,
                    2
                  ),
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
