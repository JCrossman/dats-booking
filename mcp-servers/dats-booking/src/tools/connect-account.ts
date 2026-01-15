/**
 * connect_account Tool
 *
 * Initiates secure web-based authentication with DATS.
 * Opens browser page for user to enter credentials.
 *
 * SECURITY: Credentials never touch Claude - only session tokens stored.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SessionManager } from '../auth/session-manager.js';
import type { CosmosSessionStore } from '../auth/cosmos-session-store.js';
import {
  initiateWebAuth,
  initiateWebAuthRemote,
  pollAuthResultRemote,
  isWebAuthAvailable,
} from '../auth/web-auth.js';
import { wrapError, createErrorResponse } from '../utils/errors.js';
import { ErrorCategory } from '../types.js';
import { logger } from '../utils/logger.js';
import type { ToolRegistration } from './types.js';

export interface ConnectAccountDependencies {
  sessionManager: SessionManager;
  getCosmosStore: () => CosmosSessionStore;
  isRemoteMode: () => boolean;
}

export function createConnectAccountTool(deps: ConnectAccountDependencies): ToolRegistration {
  return {
    register(server: McpServer) {
      server.tool(
        'connect_account',
        `Connect your DATS account securely. Call this first before using other tools.

HOW IT WORKS:
1. A secure webpage opens in your browser (or you'll receive a URL to open)
2. You enter your DATS client ID and passcode there (not in this chat)
3. Once connected, close the browser and come back here

PRIVACY: Your credentials are NEVER stored or sent to Claude. They go directly from your browser to DATS. Only a temporary session token is saved.

Use this tool when:
- Setting up DATS booking for the first time
- Your session has expired (typically daily)
- You want to reconnect your account

REMOTE MODE: If using Claude mobile or web, you will receive a URL to open in your browser. After authenticating, just say "done" or "connected" and your original request will continue.`,
        {},
        async () => {
          try {
            // Check if Azure auth endpoint is available
            const authAvailable = await isWebAuthAvailable();
            if (!authAvailable) {
              return createErrorResponse({
                category: ErrorCategory.NETWORK_ERROR,
                message:
                  'The secure login page is not available. Please check your internet connection and try again.',
                recoverable: true,
              });
            }

            // Remote mode: Return URL immediately, poll in background
            // User authenticates, then says "done" to continue - session will be ready
            if (deps.isRemoteMode()) {
              const authInit = initiateWebAuthRemote();

              // Start background polling - session stored automatically when auth completes
              pollAuthResultRemote(authInit.sessionId)
                .then(async (result) => {
                  if (result.success && result.sessionCookie && result.clientId) {
                    await deps.getCosmosStore().store(authInit.sessionId, {
                      sessionCookie: result.sessionCookie,
                      clientId: result.clientId,
                      createdAt: new Date().toISOString(),
                    });
                    logger.info(`Background auth completed: ${authInit.sessionId.substring(0, 8)}...`);
                  }
                })
                .catch((err) => logger.error(`Background polling error: ${err}`));

              return {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(
                      {
                        success: true,
                        action: 'open_url',
                        authUrl: authInit.authUrl,
                        sessionId: authInit.sessionId,
                        message:
                          'Open this URL to connect your DATS account. After entering your credentials, just say "done" or "connected" here.',
                        forAssistant:
                          'Show the user the authUrl link. When they say they are done/connected, IMMEDIATELY retry their original request ' +
                          'using the session_id. Do NOT ask them to repeat their request - just do what they originally asked.',
                      },
                      null,
                      2
                    ),
                  },
                ],
              };
            }

            // Local mode: Open browser and wait for auth
            await deps.sessionManager.migrateFromCredentials();

            logger.info('Starting web authentication flow');
            const result = await initiateWebAuth();

            if (!result.success || !result.sessionCookie || !result.clientId) {
              return createErrorResponse({
                category: ErrorCategory.AUTH_FAILURE,
                message: result.error || 'Could not connect to your DATS account. Please try again.',
                recoverable: true,
              });
            }

            // Store the session (encrypted)
            await deps.sessionManager.store({
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
                      message:
                        'Your DATS account is connected! Your credentials were NOT stored - only a temporary session token. You can now book trips, view upcoming trips, and more. Your session will expire when DATS invalidates it (typically daily).',
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
