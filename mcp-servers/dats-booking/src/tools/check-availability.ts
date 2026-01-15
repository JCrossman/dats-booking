/**
 * check_availability Tool
 *
 * Checks available dates and times for DATS bookings.
 * Helps users find when they can book trips.
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
import { formatAvailabilityForUser, PLAIN_LANGUAGE_GUIDELINES } from '../utils/plain-language.js';
import { parseFlexibleDate } from '../helpers/date-helpers.js';
import type { ToolRegistration } from './types.js';

export interface CheckAvailabilityDependencies {
  sessionManager: SessionManager;
  getCosmosStore: () => CosmosSessionStore;
  isRemoteMode: () => boolean;
  getValidSession: (sessionId?: string) => Promise<{ sessionCookie: string; clientId: string } | null>;
}

export function createCheckAvailabilityTool(deps: CheckAvailabilityDependencies): ToolRegistration {
  return {
    register(server: McpServer) {
      server.tool(
        'check_availability',
        `Check available dates and times for DATS bookings.

DATE FORMATS ACCEPTED:
- YYYY-MM-DD (e.g., "2026-01-15")
- Day names: "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"
- Relative: "today", "tomorrow"

When user says "Thursday", pass "thursday" directly - the server will calculate the correct date.

Use this tool to help users find when they can book a trip. You can:
- Get all available booking dates (up to 3 days ahead)
- Get the time window for a specific date

The response includes a "userMessage" field with pre-formatted plain language text.
You should display this userMessage to the user as-is.

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
            .describe('Specific date to check: YYYY-MM-DD, day name (e.g., "thursday"), or relative ("today", "tomorrow"). If not provided, returns all available dates.'),
          timezone: z
            .string()
            .optional()
            .describe('Timezone for date calculations (e.g., "America/Edmonton"). Defaults to America/Edmonton.'),
        },
        async ({ session_id, date, timezone = 'America/Edmonton' }) => {
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

            logger.info('Checking booking availability');
            const api = new DATSApi({ sessionCookie: session.sessionCookie });

            // Always get available dates
            const availableDates = await api.getBookingDaysWindow(session.clientId);

            let timeWindow: { earliest: string; latest: string } | undefined;
            let parsedDate: string | undefined;

            // If a specific date was requested, parse and get the time window for that date
            if (date) {
              parsedDate = parseFlexibleDate(date, timezone);
              if (date !== parsedDate) {
                logger.info(`Date parsing: "${date}" -> "${parsedDate}" (timezone: ${timezone})`);
              }
              // Convert YYYY-MM-DD to YYYYMMDD for API
              const apiDate = parsedDate.replace(/-/g, '');
              timeWindow = await api.getBookingTimesWindow(session.clientId, apiDate);
            }

            // Generate plain language summary (use parsed date for display)
            const userMessage = formatAvailabilityForUser(availableDates, timeWindow, parsedDate || date);

            const result = {
              success: true,
              availableDates,
              ...(date && timeWindow ? {
                requestedDate: date,
                ...(parsedDate && parsedDate !== date ? { resolvedDate: parsedDate } : {}),
                timeWindow,
              } : {}),
              userMessage,
            };

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
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
