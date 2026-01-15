/**
 * track_trip Tool
 *
 * Tracks a DATS trip in real-time.
 * Provides live vehicle location, ETA, driver info for active trips.
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
import { getCurrentDateInfo } from '../helpers/date-helpers.js';
import type { ToolRegistration } from './types.js';

export interface TrackTripDependencies {
  sessionManager: SessionManager;
  getCosmosStore: () => CosmosSessionStore;
  isRemoteMode: () => boolean;
  getValidSession: (sessionId?: string) => Promise<{ sessionCookie: string; clientId: string } | null>;
}

export function createTrackTripTool(deps: TrackTripDependencies): ToolRegistration {
  return {
    register(server: McpServer) {
      server.tool(
        'track_trip',
        `Track a DATS trip in real-time. Provides live vehicle location, ETA, and driver info.

IMPORTANT: Live tracking only works AFTER DATS has dispatched a vehicle. If tracking is not available:
1. First check trip status with get_trips
2. Show the user the actual DATS status (Scheduled, Arrived, etc.)
3. Do NOT infer that trip "has passed" - DATS status is the source of truth

Returns when available:
- Real-time ETA (estimated time of arrival)
- Vehicle location (GPS coordinates)
- Vehicle details (make, model, number)
- Driver name and provider
- Pickup/dropoff status (scheduled, arrived, departed)

**Use this tool when:**
- User asks "Where is my ride?" or "Track my ride"
- User asks "When will my ride arrive?"
- User wants driver or vehicle information
- After get_trips shows a trip is imminent

**If tracking is unavailable:**
- Use get_trips to show current DATS status
- Tell user vehicle hasn't been dispatched yet
- Do NOT say trip "has already passed" unless DATS status is Performed/Cancelled`,
        {
          session_id: z
            .string()
            .uuid()
            .optional()
            .describe('Session ID (required for remote mode, optional for local)'),
          booking_id: z.string().optional().describe('Optional booking ID to track a specific trip'),
        },
        async ({ session_id, booking_id }) => {
          try {
            const session = await deps.getValidSession(session_id);
            if (!session) {
              return createErrorResponse({
                category: ErrorCategory.CREDENTIALS_NOT_FOUND,
                message:
                  'Your session has expired or you have not connected your DATS account yet. Would you like me to open the secure login page? (Use the connect_account tool)',
                recoverable: true,
              });
            }

            const api = new DATSApi({ sessionCookie: session.sessionCookie });
            const result = await api.trackTrip(session.clientId, booking_id);

            if (!result.success) {
              // Add timezone context even for unsuccessful responses
              const timezone = 'America/Edmonton';
              const dateInfo = getCurrentDateInfo(timezone);
              const dateContext = {
                currentDate: dateInfo.today,
                currentDayOfWeek: dateInfo.dayOfWeek,
                timezone,
                note: 'All DATS times are in Edmonton timezone (MST/MDT)',
              };

              return {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify({ ...result, dateContext }, null, 2),
                  },
                ],
              };
            }

            // Format a user-friendly message with clear structure
            const lines: string[] = [];

            // Status header
            if (result.pickup.status === 'arrived') {
              lines.push('YOUR RIDE HAS ARRIVED!');
            } else if (result.vehicle) {
              lines.push('Your ride is on the way!');
            }
            lines.push('');

            // ETA section
            if (result.pickup.eta) {
              lines.push(`Estimated pickup: ${result.pickup.eta}`);
            }
            if (result.dropoff.eta) {
              lines.push(`Estimated dropoff: ${result.dropoff.eta}`);
            }
            lines.push('');

            // Route
            if (result.pickup.address) {
              lines.push(`From: ${result.pickup.address}`);
            }
            if (result.dropoff.address) {
              lines.push(`To: ${result.dropoff.address}`);
            }
            lines.push('');

            // Vehicle & Driver info
            if (result.vehicle) {
              lines.push('--- Vehicle Info ---');
              lines.push(`Vehicle: ${result.vehicle.make} ${result.vehicle.model} #${result.vehicle.vehicleNumber}`);
              lines.push(`Driver: ${result.vehicle.driverName}`);
              if (result.provider) {
                lines.push(`Provider: ${result.provider}`);
              }
              lines.push('');
            }

            lines.push(`Last updated: ${result.lastChecked}`);

            const userMessage = lines.join('\n');

            // Add timezone context to help Claude display times correctly
            const timezone = 'America/Edmonton';
            const dateInfo = getCurrentDateInfo(timezone);
            const dateContext = {
              currentDate: dateInfo.today,
              currentDayOfWeek: dateInfo.dayOfWeek,
              timezone,
              note: 'All DATS times are in Edmonton timezone (MST/MDT). The lastChecked timestamp is in UTC ISO format.',
            };

            // Add display instructions for Claude
            const displayInstructions = `
DISPLAY THIS TRACKING INFO CLEARLY:
- Show the ETA prominently
- Include ALL vehicle and driver details
- Use simple text format (not tables) for mobile readability
- If vehicle has arrived, emphasize that fact
- IMPORTANT: All trip times are in Edmonton timezone (MST/MDT), NOT UTC
`.trim();

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ ...result, userMessage, dateContext, displayInstructions }, null, 2),
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
