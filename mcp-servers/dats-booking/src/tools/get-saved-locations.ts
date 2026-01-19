/**
 * get_saved_locations Tool
 *
 * Retrieves user's saved locations (registered addresses + frequently used destinations).
 * Combines registered addresses with frequently visited places from trip history.
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

export interface GetSavedLocationsDependencies {
  sessionManager: SessionManager;
  getCosmosStore: () => CosmosSessionStore;
  isRemoteMode: () => boolean;
  getValidSession: (sessionId?: string) => Promise<{ sessionCookie: string; clientId: string } | null>;
}

export function createGetSavedLocationsTool(deps: GetSavedLocationsDependencies): ToolRegistration {
  return {
    register(server: McpServer) {
      server.tool(
        'get_saved_locations',
        `Get user's saved locations (registered addresses + frequently used destinations).

Returns merged list of:
- Registered addresses (home, mailing) with pickup instructions
- Frequently visited places from trip history
- Named locations (schools, facilities)

LOCATION TYPES:
- Client Home (CH): Primary residence
- Client Mailing (CM): Mailing address
- Named Location (LO): Schools, facilities with names
- Frequent Address (AD): Geocoded addresses from past trips

Each location includes:
- Full address with lat/lon coordinates
- Source: "Registered", "Frequent", or "Both"
- Pickup instructions (if registered)
- Contact phone (if registered)
- Usage information (if frequent)

PRESENTATION INSTRUCTIONS:
When showing locations to the user, format as a clean numbered list:

**Example:**
You have 14 saved locations:

1. **Client Home**
   📍 9713 160 Street NW, Edmonton, AB T5P3C9

2. **McNally Senior High School**
   📍 8440 105 Avenue NW, Edmonton, AB T6A1B6

3. **Address**
   📍 8882 170 Street NW, Edmonton, AB T5R4H5

DO NOT show raw pipe-delimited tables or JSON. Use numbered list with bold names and address on new line.

Use this for:
- Address autocomplete with user's history
- "Select from your saved locations"
- Smart defaults based on usage patterns

REMOTE MODE: Include session_id from connect_account/complete_connection.

${PLAIN_LANGUAGE_GUIDELINES}`,
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

            logger.info('Fetching saved locations');
            const api = new DATSApi({ sessionCookie: session.sessionCookie });

            // Call the new merged locations API
            const locations = await api.getClientLocationsMerged(session.clientId);

            // Format locations for user display
            const formattedLocations = locations.map((loc, index) => {
              const address = `${loc.streetNo} ${loc.onStreet}${loc.unit ? ` Unit ${loc.unit}` : ''}`;
              const cityState = `${loc.city}, ${loc.state} ${loc.zipCode}`;

              return {
                number: index + 1,
                type: loc.source.toLowerCase(),
                name: loc.addrName || loc.addrDescr || 'Address',
                address,
                cityState,
                fullAddress: `${address}, ${cityState}`,
                lat: loc.lat / 1000000, // Convert from microdegrees
                lon: loc.lon / 1000000, // Convert from microdegrees
                comments: loc.comments,
                phone: loc.phone,
                source: loc.source,
                addressMode: loc.addressMode,
                addrType: loc.addrType,
              };
            });

            // Create clean numbered list
            const locationList = formattedLocations.map(loc => {
              let entry = `${loc.number}. **${loc.name}**\n   📍 ${loc.fullAddress}`;
              
              if (loc.comments) {
                entry += `\n   💬 ${loc.comments}`;
              }
              if (loc.phone) {
                entry += `\n   📞 ${loc.phone}`;
              }
              
              return entry;
            });

            const userMessage =
              locations.length > 0
                ? `You have ${locations.length} saved location${locations.length === 1 ? '' : 's'}:\n\n` +
                  locationList.join('\n\n')
                : 'No saved locations found in your DATS profile.';

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    {
                      success: true,
                      locations: formattedLocations,
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
