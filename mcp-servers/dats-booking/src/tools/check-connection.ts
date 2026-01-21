/**
 * check_connection Tool
 *
 * Verifies that DATS session is ready after authentication.
 * Used to prevent race conditions where user says "done" but background polling hasn't completed.
 *
 * USAGE: Call this after user completes authentication and says "done" or "connected".
 * It will poll Cosmos DB until session is found (max 30 seconds).
 *
 * SECURITY: Only checks session existence, doesn't return sensitive data.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { CosmosSessionStore } from '../auth/cosmos-session-store.js';
import { ErrorCategory } from '../types.js';
import { wrapError, createErrorResponse } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import type { ToolRegistration } from './types.js';

export interface CheckConnectionDependencies {
  getCosmosStore: () => CosmosSessionStore;
  isRemoteMode: () => boolean;
}

const POLL_INTERVAL_MS = 2000; // 2 seconds
const POLL_TIMEOUT_MS = 30000; // 30 seconds

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createCheckConnectionTool(deps: CheckConnectionDependencies): ToolRegistration {
  return {
    register(server: McpServer) {
      server.tool(
        'check_connection',
        `Check if DATS session is ready after authentication.

USAGE: Call this after user completes browser authentication and says "done" or "connected".
This tool polls for up to 30 seconds to verify the session was stored successfully.

WHEN TO USE:
- After connect_account returns auth URL
- User has opened browser and entered credentials
- User says "done", "connected", or "finished"

RETURNS:
- success: true if session is ready
- waitedSeconds: how long it took to verify session
- message: status message for user

ERROR CASES:
- Session not found after 30 seconds (user may not have completed auth)
- Not in remote mode (this tool only needed for remote mode)
- Invalid session_id format`,
        {
          session_id: z
            .string()
            .uuid()
            .describe('The session_id returned by connect_account when auth URL was shown'),
        },
        async ({ session_id }) => {
          try {
            // Local mode doesn't need this - session stored synchronously
            if (!deps.isRemoteMode()) {
              return {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(
                      {
                        success: true,
                        message:
                          'Local mode: Session is ready immediately after authentication. ' +
                          'No need to check - you can proceed with your request.',
                        localMode: true,
                      },
                      null,
                      2
                    ),
                  },
                ],
              };
            }

            logger.info(`Checking connection for session: ${session_id.substring(0, 8)}...`);

            const startTime = Date.now();
            let pollCount = 0;

            // Poll for session existence
            while (Date.now() - startTime < POLL_TIMEOUT_MS) {
              pollCount++;

              try {
                const session = await deps.getCosmosStore().retrieve(session_id);

                if (session) {
                  const waitedSeconds = Math.round((Date.now() - startTime) / 1000);
                  logger.info(
                    `Session ready after ${waitedSeconds}s (${pollCount} polls): ${session_id.substring(0, 8)}...`
                  );

                  return {
                    content: [
                      {
                        type: 'text',
                        text: JSON.stringify(
                          {
                            success: true,
                            ready: true,
                            waitedSeconds,
                            sessionId: session_id,
                            message:
                              'Your DATS account is connected and ready! You can now proceed with your original request.',
                            forAssistant:
                              'Session is ready. IMMEDIATELY retry the user\'s original request with this session_id. ' +
                              'Example: If user asked "show my trips", call get_trips({session_id: "..."})',
                          },
                          null,
                          2
                        ),
                      },
                    ],
                  };
                }

                // Session not found yet - wait and retry
                logger.debug(`Poll #${pollCount}: Session not ready yet, waiting...`);
                await sleep(POLL_INTERVAL_MS);
              } catch (pollError) {
                // Log but continue polling - might be transient Cosmos error
                logger.debug(`Poll #${pollCount} error (continuing): ${pollError}`);
                await sleep(POLL_INTERVAL_MS);
              }
            }

            // Timeout reached - session never appeared
            const waitedSeconds = Math.round((Date.now() - startTime) / 1000);
            logger.warn(
              `Session not ready after ${waitedSeconds}s (${pollCount} polls): ${session_id.substring(0, 8)}...`
            );

            return createErrorResponse({
              category: ErrorCategory.AUTH_FAILURE,
              message:
                'Authentication session not found after 30 seconds. ' +
                'This usually means authentication was not completed in the browser. ' +
                'Please try again: call connect_account to get a new auth URL.',
              recoverable: true,
            });
          } catch (error) {
            const datsError = wrapError(error);
            return createErrorResponse(datsError.toToolError());
          }
        }
      );
    },
  };
}
