/**
 * get_trips Tool
 *
 * Retrieves DATS trips with flexible filtering options.
 * Supports date ranges, status filtering, and flexible date formats.
 *
 * SECURITY: Requires valid session from connect_account.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SessionManager } from '../auth/session-manager.js';
import type { CosmosSessionStore } from '../auth/cosmos-session-store.js';
import { DATSApi } from '../api/dats-api.js';
import { ErrorCategory, type TripStatusCode, TRIP_STATUSES } from '../types.js';
import { wrapError, createErrorResponse } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { formatTripsForUser, PLAIN_LANGUAGE_GUIDELINES } from '../utils/plain-language.js';
import { parseFlexibleDate, normalizeTripDate, getCurrentDateInfo } from '../helpers/date-helpers.js';
import type { ToolRegistration } from './types.js';

export interface GetTripsDependencies {
  sessionManager: SessionManager;
  getCosmosStore: () => CosmosSessionStore;
  isRemoteMode: () => boolean;
  getValidSession: (sessionId?: string) => Promise<{ sessionCookie: string; clientId: string } | null>;
}

export function createGetTripsTool(deps: GetTripsDependencies): ToolRegistration {
  return {
    register(server: McpServer) {
      server.tool(
        'get_trips',
        `Retrieve DATS trips. By default shows today's trips (all statuses) plus future Scheduled trips.

DATE FORMATS ACCEPTED:
- YYYY-MM-DD (e.g., "2026-01-15")
- Day names: "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"
- Relative: "today", "tomorrow"
- Next week: "next monday", "next tuesday", etc.

When user says "Thursday", pass "thursday" directly - the server will calculate the correct date.

TRIP DATA INCLUDES:
- Date, pickup window, pickup/destination addresses (full addresses)
- Status (Scheduled, Performed, Cancelled, etc.)
- Mobility device, passengers, phone numbers, fare

FILTERING OPTIONS:
- By default: Today's trips (all statuses) + future Scheduled trips only
- include_all: true - Show ALL trips including past Performed, Cancelled, No Show, etc.
- status_filter: Filter to specific status(es) like ["Pf"] for Performed, ["CA"] for Cancelled

STATUS CODES:
- S = Scheduled, U = Unscheduled, A = Arrived, Pn = Pending
- Pf = Performed, CA = Cancelled, NS = No Show, NM = Missed, R = Refused

The response includes a "userMessage" field with trips formatted as a markdown table.
You should display this userMessage to the user as-is.

**FOR ACTIVE/CURRENT TRIPS:** If a trip is happening NOW or within 60 minutes,
ALSO use the track_trip tool to get real-time details (vehicle location, driver name, ETA).

REMOTE MODE: Include session_id from connect_account/complete_connection.

${PLAIN_LANGUAGE_GUIDELINES}`,
        {
          session_id: z
            .string()
            .uuid()
            .optional()
            .describe('Session ID (required for remote mode, optional for local)'),
          date_from: z
            .string()
            .optional()
            .describe('Start date: YYYY-MM-DD, day name (e.g., "thursday"), or relative ("today", "tomorrow"). Defaults to today.'),
          date_to: z
            .string()
            .optional()
            .describe('End date: YYYY-MM-DD, day name, or relative. Defaults to 2 months from now.'),
          timezone: z
            .string()
            .optional()
            .describe('Timezone for date calculations (e.g., "America/Edmonton"). Defaults to America/Edmonton for DATS users.'),
          include_all: z
            .boolean()
            .optional()
            .describe('Set to true to include ALL trips (Performed, Cancelled, etc.). Defaults to false.'),
          status_filter: z
            .array(z.enum(['S', 'U', 'A', 'Pn', 'Pf', 'CA', 'NS', 'NM', 'R']))
            .optional()
            .describe('Filter to specific status(es). Example: ["Pf"] for Performed only, ["Pf", "CA"] for Performed and Cancelled.'),
        },
        async ({ session_id, date_from, date_to, timezone = 'America/Edmonton', include_all = false, status_filter }) => {
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

            logger.info('Using session for trip retrieval');
            const api = new DATSApi({ sessionCookie: session.sessionCookie });

            // Parse flexible dates (handles "thursday", "tomorrow", etc.)
            const parsedFromDate = date_from ? parseFlexibleDate(date_from, timezone) : undefined;
            const parsedToDate = date_to ? parseFlexibleDate(date_to, timezone) : undefined;

            // Log the date parsing for debugging
            if (date_from) {
              logger.info(`Date parsing: "${date_from}" -> "${parsedFromDate}" (timezone: ${timezone})`);
            }

            // Convert date format (YYYY-MM-DD to YYYYMMDD)
            const fromDate = parsedFromDate ? parsedFromDate.replace(/-/g, '') : undefined;
            const toDate = parsedToDate ? parsedToDate.replace(/-/g, '') : undefined;

            let trips = await api.getClientTrips(session.clientId, fromDate, toDate);

            // Apply status filtering
            if (status_filter && status_filter.length > 0) {
              // Filter to specific statuses requested
              trips = trips.filter(trip => status_filter.includes(trip.status as TripStatusCode));
            } else if (!include_all) {
              // Default: Today's trips (ALL statuses) + future active trips only
              // This ensures completed/cancelled trips for today are visible
              const todayStr = getCurrentDateInfo(timezone).today; // YYYY-MM-DD format

              trips = trips.filter(trip => {
                // Parse the trip date to compare with today
                // Trip date format is "Tue, Jan 13, 2026"
                const tripDateNormalized = normalizeTripDate(trip.date);
                const isToday = tripDateNormalized === todayStr;

                // Show ALL trips for today (including Performed, Cancelled, etc.)
                if (isToday) {
                  return true;
                }

                // For future trips, only show active statuses
                const statusInfo = TRIP_STATUSES[trip.status as TripStatusCode];
                return statusInfo?.isActive ?? false;
              });
            }
            // If include_all is true and no status_filter, show everything

            // Generate plain language summary for the user
            const userMessage = formatTripsForUser(trips);

            // Include date context in response
            const dateInfo = getCurrentDateInfo(timezone);
            const dateContext = {
              serverDate: dateInfo.today,
              serverDayOfWeek: dateInfo.dayOfWeek,
              timezone,
              ...(date_from && parsedFromDate !== date_from ? { requestedDate: date_from, resolvedDate: parsedFromDate } : {}),
            };

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ success: true, trips, dateContext, userMessage }, null, 2),
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
