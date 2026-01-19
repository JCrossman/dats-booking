/**
 * get_profile Tool
 *
 * Gets DATS client profile including personal info, contacts, and saved locations.
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
import { formatSavedLocations } from '../utils/plain-language.js';
import type { ToolRegistration } from './types.js';

export interface GetProfileDependencies {
  sessionManager: SessionManager;
  getCosmosStore: () => CosmosSessionStore;
  isRemoteMode: () => boolean;
  getValidSession: (sessionId?: string) => Promise<{ sessionCookie: string; clientId: string } | null>;
}

export function createGetProfileTool(deps: GetProfileDependencies): ToolRegistration {
  return {
    register(server: McpServer) {
      server.tool(
        'get_profile',
        `Get your DATS client profile including personal info, contact details, and mobility aids.

PROFILE DATA INCLUDES:
- Personal information (name, address, phone)
- Contact details (emergency contacts, multiple phone numbers)
- Mobility aids and space requirements
- Saved locations (registered addresses + frequently used places)

NOT AVAILABLE:
- Communication preferences (use MCP settings)
- Account statements or billing history (DATS handles separately)

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

            logger.info('Fetching DATS client profile');
            const api = new DATSApi({ sessionCookie: session.sessionCookie });

            // Get both client info and contact info
            const [clientInfo, contactInfo, mergedLocations] = await Promise.all([
              api.getClientInfo(session.clientId),
              api.getContactInfo(session.clientId),
              api.getClientLocationsMerged(session.clientId),
            ]);

            // Map merged locations to simple format for formatSavedLocations
            const savedLocations = mergedLocations.map(loc => ({
              name: loc.addrName || loc.addrDescr,
              address: `${loc.streetNo} ${loc.onStreet}`,
              city: loc.city,
              state: loc.state,
              zipCode: loc.zipCode,
            }));

            // Format saved locations as a markdown table
            const savedLocationsMessage = formatSavedLocations(savedLocations);

            // Build user-friendly message about data availability
            const hasContactInfo = contactInfo && (
              contactInfo.homePhone || contactInfo.workPhone ||
              contactInfo.cellPhone || contactInfo.email ||
              contactInfo.emergencyContacts.length > 0
            );

            const notes: string[] = [];
            if (!hasContactInfo) {
              notes.push('No additional contact information found in DATS system (phone numbers, email, emergency contacts).');
            }

            // Build the full user message
            const userMessage = [
              'Your DATS Profile:',
              '',
              clientInfo ? `Name: ${clientInfo.firstName} ${clientInfo.lastName}` : '',
              clientInfo?.phone ? `Phone: ${clientInfo.phone}` : '',
              '',
              savedLocationsMessage,
              '',
              ...notes,
            ]
              .filter(line => line !== null && line !== undefined)
              .join('\n');

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    {
                      success: true,
                      profile: {
                        ...clientInfo,
                        contact: contactInfo,
                        savedLocations,
                      },
                      userMessage,
                      forAssistant: 'Display the userMessage to the user as-is (it contains pre-formatted markdown). The profile was retrieved successfully.',
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
