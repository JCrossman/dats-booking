/**
 * get_frequent_trips Tool
 *
 * Retrieves user's most frequently used trip pairs for quick rebooking.
 * Returns trips sorted by usage count (most used first).
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

export interface GetFrequentTripsDependencies {
  sessionManager: SessionManager;
  getCosmosStore: () => CosmosSessionStore;
  isRemoteMode: () => boolean;
  getValidSession: (sessionId?: string) => Promise<{ sessionCookie: string; clientId: string } | null>;
}

export function createGetFrequentTripsTool(deps: GetFrequentTripsDependencies): ToolRegistration {
  return {
    register(server: McpServer) {
      server.tool(
        'get_frequent_trips',
        `Get user's most frequently used trip pairs for quick rebooking.

Returns trips sorted by usage count (most used first), showing:
- Pickup and dropoff addresses (full address with names if available)
- Number of times this trip was used
- Mobility aids used on these trips

Use this for:
- "Book my usual trip to McNally High School"
- Smart suggestions: "You often go here on Mondays"
- One-tap rebooking UI
- Quick rebooking: "Same as last Monday"

The from_date parameter controls how far back to analyze trip history.
Default is 60 days ago.

REMOTE MODE: Include session_id from connect_account/complete_connection.

${PLAIN_LANGUAGE_GUIDELINES}`,
        {
          session_id: z
            .string()
            .uuid()
            .optional()
            .describe('Session ID (required for remote mode, optional for local)'),
          from_date: z
            .string()
            .optional()
            .describe('Analyze trips from this date (YYYYMMDD). Defaults to 60 days ago.'),
        },
        async ({ session_id, from_date }) => {
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

            logger.info('Fetching frequent trips');
            const api = new DATSApi({ sessionCookie: session.sessionCookie });

            // Default: 60 days ago
            const fromDate =
              from_date ||
              (() => {
                const date = new Date();
                date.setDate(date.getDate() - 60);
                return date.toISOString().split('T')[0].replace(/-/g, '');
              })();

            logger.debug(`Fetching frequent trips from date: ${fromDate}`);

            const trips = await api.getMostFrequentClientTrips(session.clientId, fromDate);

            // Format trips for user display
            const formattedTrips = trips.map(trip => {
              const fromAddress = trip.pickup.addrName
                ? `${trip.pickup.addrName} (${trip.pickup.streetNo} ${trip.pickup.onStreet})`
                : `${trip.pickup.streetNo} ${trip.pickup.onStreet}`;

              const toAddress = trip.dropoff.addrName
                ? `${trip.dropoff.addrName} (${trip.dropoff.streetNo} ${trip.dropoff.onStreet})`
                : `${trip.dropoff.streetNo} ${trip.dropoff.onStreet}`;

              return {
                useCount: trip.useCount,
                from: {
                  name: trip.pickup.addrName || undefined,
                  address: `${trip.pickup.streetNo} ${trip.pickup.onStreet}`,
                  city: trip.pickup.city,
                  fullAddress: fromAddress,
                  lat: trip.pickup.lat / 1000000,
                  lon: trip.pickup.lon / 1000000,
                },
                to: {
                  name: trip.dropoff.addrName || undefined,
                  address: `${trip.dropoff.streetNo} ${trip.dropoff.onStreet}`,
                  city: trip.dropoff.city,
                  fullAddress: toAddress,
                  lat: trip.dropoff.lat / 1000000,
                  lon: trip.dropoff.lon / 1000000,
                },
                mobilityAids: trip.mobilityAids,
              };
            });

            // Create markdown table for display
            const tripRows = formattedTrips.map(trip => {
              return `| ${trip.useCount}x | ${trip.from.fullAddress} | ${trip.to.fullAddress} |`;
            });

            const userMessage =
              trips.length > 0
                ? `Found ${trips.length} frequent trip${trips.length === 1 ? '' : 's'} (analyzed from ${fromDate}):\n\n` +
                  `| Times Used | From | To |\n` +
                  `|------------|------|----|\n` +
                  tripRows.join('\n')
                : `No frequent trips found in your history since ${fromDate}.`;

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    {
                      success: true,
                      frequentTrips: formattedTrips,
                      fromDate,
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
