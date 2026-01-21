/**
 * connect_account Tool
 *
 * Initiates secure web-based authentication with DATS.
 * Opens browser page for user to enter credentials.
 *
 * SECURITY: Credentials never touch Claude - only session tokens stored.
 * POPA COMPLIANCE: Requires consent before storing session in Azure (remote mode).
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SessionManager } from '../auth/session-manager.js';
import type { CosmosSessionStore } from '../auth/cosmos-session-store.js';
import { ConsentManager } from '../auth/consent-manager.js';
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
import crypto from 'crypto';

export interface ConnectAccountDependencies {
  sessionManager: SessionManager;
  getCosmosStore: () => CosmosSessionStore;
  isRemoteMode: () => boolean;
}

export function createConnectAccountTool(deps: ConnectAccountDependencies): ToolRegistration {
  // Initialize consent manager (lazy-loaded for remote mode)
  let consentManager: ConsentManager | null = null;
  const getConsentManager = (): ConsentManager => {
    if (!consentManager) {
      consentManager = new ConsentManager(deps.getCosmosStore());
    }
    return consentManager;
  };

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

REMOTE MODE: If using Claude mobile or web, you will be asked to consent to session storage in Azure Canada (POPA compliant) before proceeding. After authenticating, just say "done" or "connected" and your original request will continue.

Use this tool when:
- Setting up DATS booking for the first time
- Your session has expired (typically daily)
- You want to reconnect your account`,
        {
          consent_given: z
            .boolean()
            .optional()
            .describe(
              'Set to true if user has consented to data storage (remote mode only). Required before storing session in Azure.'
            ),
        },
        async ({ consent_given }) => {
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

            // Remote mode: Check consent first
            if (deps.isRemoteMode()) {
              // If consent not given, show privacy notice
              if (!consent_given) {
                const consentNotice = getConsentManager().getConsentNotice();
                
                logger.audit({
                  action: 'consent_prompt_shown',
                  result: 'success',
                });

                return {
                  content: [
                    {
                      type: 'text',
                      text: JSON.stringify(
                        {
                          consent_required: true,
                          privacy_notice: consentNotice,
                          message:
                            'To use DATS booking on mobile/web, we need your consent to temporarily store your session in Azure Canada (encrypted, 24-hour expiration).',
                          next_step:
                            'Please read the privacy notice above. If you consent, call this tool again with consent_given: true',
                          forAssistant:
                            'Show the user the privacy notice. Ask if they consent to the data storage. If they say yes/agree/consent, ' +
                            'call connect_account again with {consent_given: true}. If they decline, apologize and explain the service requires consent.',
                        },
                        null,
                        2
                      ),
                    },
                  ],
                };
              }

              // Consent given - proceed with authentication
              const authInit = initiateWebAuthRemote();

              logger.audit({
                action: 'consent_recorded',
                result: 'success',
                sessionIdHash: hashSessionId(authInit.sessionId),
                privacyPolicyVersion: '1.0',
              });

              // Start background polling - session stored automatically when auth completes
              pollAuthResultRemote(authInit.sessionId)
                .then(async (result) => {
                  if (result.success && result.sessionCookie && result.clientId) {
                    await deps.getCosmosStore().store(authInit.sessionId, {
                      sessionCookie: result.sessionCookie,
                      clientId: result.clientId,
                      createdAt: new Date().toISOString(),
                    });
                    
                    logger.audit({
                      action: 'session_stored',
                      result: 'success',
                      sessionIdHash: hashSessionId(authInit.sessionId),
                    });
                    
                    logger.info(`Background auth completed: ${authInit.sessionId.substring(0, 8)}...`);
                  }
                })
                .catch((err) => {
                  logger.error(`Background polling error: ${err}`);
                  logger.audit({
                    action: 'session_storage_failed',
                    result: 'failure',
                    sessionIdHash: hashSessionId(authInit.sessionId),
                    errorCode: 'polling_error',
                  });
                });

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
                          'CRITICAL INSTRUCTIONS:\n' +
                          '1. Display the authUrl link to the user\n' +
                          '2. When user says "done"/"connected", wait 2-3 seconds for background polling to complete\n' +
                          '3. Then IMMEDIATELY retry their ORIGINAL request using session_id (e.g., get_trips with session_id)\n' +
                          '4. Do NOT call complete_connection - it is deprecated and causes hangs\n' +
                          '5. Do NOT ask user to repeat their request - just execute it automatically',
                      },
                      null,
                      2
                    ),
                  },
                ],
              };
            }

            // Local mode: Open browser and wait for auth (no consent needed)
            await deps.sessionManager.migrateFromCredentials();

            logger.info('Starting web authentication flow');
            logger.audit({
              action: 'local_auth_started',
              result: 'success',
            });

            const result = await initiateWebAuth();

            if (!result.success || !result.sessionCookie || !result.clientId) {
              logger.audit({
                action: 'local_auth_failed',
                result: 'failure',
                errorCode: 'auth_failed',
              });

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

            logger.audit({
              action: 'local_session_stored',
              result: 'success',
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
            logger.audit({
              action: 'connect_account_error',
              result: 'failure',
              errorCode: datsError.category,
            });
            return createErrorResponse(datsError.toToolError());
          }
        }
      );
    },
  };
}

/**
 * Hash session ID for audit logging (prevents PII in logs)
 */
function hashSessionId(sessionId: string): string {
  return crypto.createHash('sha256').update(sessionId).digest('hex').substring(0, 16);
}
