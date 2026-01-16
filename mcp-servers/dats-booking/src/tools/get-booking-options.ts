/**
 * get_booking_options Tool
 *
 * Retrieves all available booking options (mobility aids, fare types, trip purposes) from DATS.
 * Returns current DATS-supported values with descriptions.
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
import { PLAIN_LANGUAGE_GUIDELINES } from '../utils/plain-language.js';
import type { ToolRegistration } from './types.js';

export interface GetBookingOptionsDependencies {
  sessionManager: SessionManager;
  getCosmosStore: () => CosmosSessionStore;
  isRemoteMode: () => boolean;
  getValidSession: (sessionId?: string) => Promise<{ sessionCookie: string; clientId: string } | null>;
}

export function createGetBookingOptionsTool(deps: GetBookingOptionsDependencies): ToolRegistration {
  return {
    register(server: McpServer) {
      server.tool(
        'get_booking_options',
        `Get all available booking options (mobility aids, fare types, trip purposes) from DATS.

Returns current DATS-supported values with descriptions:
- Mobility devices (wheelchair, scooter, walker, etc.)
- Passenger types (client, escort, PCA, child under 6)
- Fare types (tickets, cash, ARC card, etc.)
- Trip purposes (work, medical, shopping, etc.)

Use this to:
- Show dropdown options to user
- Validate user input
- Display descriptions (e.g., "Electric wheelchair" not just "EW")

REMOTE MODE: Include session_id from connect_account/complete_connection.

${PLAIN_LANGUAGE_GUIDELINES}`,
        {
          session_id: z
            .string()
            .uuid()
            .optional()
            .describe('Session ID (required for remote mode, optional for local)'),
          date: z
            .string()
            .optional()
            .describe('Date for booking (YYYYMMDD). Defaults to today.'),
        },
        async ({ session_id, date }) => {
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

            logger.info('Fetching booking options');
            const api = new DATSApi({ sessionCookie: session.sessionCookie });

            // Default to today if no date provided
            const bookingDate =
              date ||
              (() => {
                const now = new Date();
                return now.toISOString().split('T')[0].replace(/-/g, '');
              })();

            logger.debug(`Fetching booking options for date: ${bookingDate}`);

            const options = await api.getDefaultBooking(session.clientId, bookingDate);

            // Format options for user display
            const mobilityDevices = options.spaceTypes.map(st => ({
              code: st.abbreviation,
              description: st.description,
            }));

            const passengerTypes = options.passengerTypes.map(pt => ({
              code: pt.abbreviation,
              description: pt.description,
              defaultSpaceType: pt.defaultSpaceType,
            }));

            const fareTypes = options.fareTypes.map(ft => ({
              id: ft.fareType,
              code: ft.abbreviation,
              description: ft.description,
            }));

            const purposes = options.purposes.map(p => ({
              id: p.bookingPurposeId,
              code: p.code,
              description: p.description,
            }));

            // Create markdown tables for display
            const mobilityTable =
              `**Mobility Devices:**\n` +
              `| Code | Description |\n` +
              `|------|-------------|\n` +
              mobilityDevices.map(m => `| ${m.code} | ${m.description} |`).join('\n');

            const purposeTable =
              `\n\n**Trip Purposes:**\n` +
              `| Code | Description |\n` +
              `|------|-------------|\n` +
              purposes.map(p => `| ${p.code} | ${p.description} |`).join('\n');

            const fareTable =
              `\n\n**Fare Types:**\n` +
              `| Code | Description |\n` +
              `|------|-------------|\n` +
              fareTypes.map(f => `| ${f.code} | ${f.description} |`).join('\n');

            const userMessage =
              `DATS Booking Options:\n\n` + mobilityTable + purposeTable + fareTable;

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    {
                      success: true,
                      mobilityDevices,
                      passengerTypes,
                      fareTypes,
                      purposes,
                      userMessage,
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
