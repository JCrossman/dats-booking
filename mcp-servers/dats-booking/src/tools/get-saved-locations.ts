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
            const formattedLocations = locations.map(loc => {
              const address = `${loc.streetNo} ${loc.onStreet}${loc.unit ? ` Unit ${loc.unit}` : ''}`;
              const cityState = `${loc.city}, ${loc.state} ${loc.zipCode}`;

              return {
                type: loc.source.toLowerCase(),
                name: loc.addrName || loc.addrDescr,
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

            // Create markdown table for display
            const locationRows = formattedLocations.map(loc => {
              const pickupInstructions = loc.comments ? `📍 ${loc.comments}` : '';
              const phone = loc.phone ? `📞 ${loc.phone}` : '';
              const details = [pickupInstructions, phone].filter(Boolean).join(' • ');

              return `| ${loc.name} | ${loc.fullAddress} | ${loc.source} | ${details || '-'} |`;
            });

            const userMessage =
              locations.length > 0
                ? `Found ${locations.length} saved location${locations.length === 1 ? '' : 's'}:\n\n` +
                  `| Name | Address | Source | Details |\n` +
                  `|------|---------|--------|----------|\n` +
                  locationRows.join('\n')
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
