/**
 * complete_connection Tool
 *
 * [DEPRECATED] This tool is no longer used - connect_account handles auth automatically.
 * Returns error immediately if called.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { CosmosSessionStore } from '../auth/cosmos-session-store.js';
import { ErrorCategory } from '../types.js';
import { wrapError, createErrorResponse } from '../utils/errors.js';
import type { ToolRegistration } from './types.js';

export interface CompleteConnectionDependencies {
  getCosmosStore: () => CosmosSessionStore;
  isRemoteMode: () => boolean;
}

export function createCompleteConnectionTool(_deps: CompleteConnectionDependencies): ToolRegistration {
  return {
    register(server: McpServer) {
      server.tool(
        'complete_connection',
        `[DEPRECATED] This tool is NO LONGER NEEDED and should NOT be called.

In remote mode, connect_account now handles authentication automatically with background polling.
When the user says "done", just retry their original request with the session_id - don't call this tool.

If you call this tool anyway, it will return an error immediately instead of hanging for 3 minutes.`,
        {
          session_id: z
            .string()
            .uuid()
            .describe('The session_id returned by connect_account'),
        },
        async ({ session_id: _session_id }) => {
          try {
            // This tool is deprecated - return error immediately
            return createErrorResponse({
              category: ErrorCategory.VALIDATION_ERROR,
              message:
                'complete_connection is deprecated. When user says "done", just retry their original request with the session_id. ' +
                'Do NOT call this tool - it causes hangs. Example: get_trips({session_id: "..."})',
              recoverable: true,
            });

            // Old implementation below (kept for reference, never reached)
            /*
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
            */
          } catch (error) {
            const datsError = wrapError(error);
            return createErrorResponse(datsError.toToolError());
          }
        }
      );
    },
  };
}
