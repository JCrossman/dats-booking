/**
 * book_trip Tool
 *
 * Creates a new DATS booking with full options.
 * Supports flexible date formats and comprehensive booking options.
 *
 * SECURITY: Requires valid session from connect_account.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SessionManager } from '../auth/session-manager.js';
import type { CosmosSessionStore } from '../auth/cosmos-session-store.js';
import { DATSApi } from '../api/dats-api.js';
import { ErrorCategory, type MobilityDevice } from '../types.js';
import { wrapError, createErrorResponse } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { formatBookingConfirmation, PLAIN_LANGUAGE_GUIDELINES } from '../utils/plain-language.js';
import { parseFlexibleDate } from '../helpers/date-helpers.js';
import type { ToolRegistration } from './types.js';

export interface BookTripDependencies {
  sessionManager: SessionManager;
  getCosmosStore: () => CosmosSessionStore;
  isRemoteMode: () => boolean;
  getValidSession: (sessionId?: string) => Promise<{ sessionCookie: string; clientId: string } | null>;
}

export function createBookTripTool(deps: BookTripDependencies): ToolRegistration {
  return {
    register(server: McpServer) {
      server.tool(
        'book_trip',
        `Create a new DATS booking. Requires credentials to be set up first.

DATE FORMATS ACCEPTED:
- YYYY-MM-DD (e.g., "2026-01-15")
- Day names: "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"
- Relative: "today", "tomorrow"
- Next week: "next monday", "next tuesday", etc.

When user says "Thursday", pass "thursday" directly - the server will calculate the correct date.

IMPORTANT: Before calling this tool, always confirm with the user by summarizing the booking details (date, time, pickup address, destination, and any special options like mobility device or companions) and explicitly asking "Do you want me to book this trip?" Only proceed after user confirms.

The response includes a "userMessage" field with pre-formatted plain language confirmation.
You should display this userMessage to the user as-is.

REMOTE MODE: Include session_id from connect_account/complete_connection.

${PLAIN_LANGUAGE_GUIDELINES}`,
        {
          session_id: z
            .string()
            .uuid()
            .optional()
            .describe('Session ID (required for remote mode, optional for local)'),
          pickup_date: z
            .string()
            .describe('Pickup date: YYYY-MM-DD, day name (e.g., "thursday"), or relative ("today", "tomorrow")'),
          pickup_time: z
            .string()
            .regex(/^\d{2}:\d{2}$/)
            .describe('Desired pickup time in HH:MM 24-hour format'),
          timezone: z
            .string()
            .optional()
            .describe('Timezone for date calculations (e.g., "America/Edmonton"). Defaults to America/Edmonton.'),
          pickup_address: z
            .string()
            .min(5)
            .describe('Full pickup address in Edmonton'),
          destination_address: z.string().min(5).describe('Full destination address'),
          mobility_device: z
            .enum(['wheelchair', 'scooter', 'walker', 'none'])
            .optional()
            .describe('Type of mobility device, if any'),
          companion: z
            .boolean()
            .optional()
            .describe('Whether a companion will travel with you'),
          return_trip: z
            .boolean()
            .optional()
            .describe('Whether to book a return trip'),
          pickup_phone: z
            .string()
            .optional()
            .describe('Callback phone number for pickup location'),
          dropoff_phone: z
            .string()
            .optional()
            .describe('Callback phone number for dropoff location'),
          pickup_comments: z
            .string()
            .optional()
            .describe('Special instructions or comments for pickup (e.g., "use side entrance")'),
          dropoff_comments: z
            .string()
            .optional()
            .describe('Special instructions or comments for dropoff'),
          additional_passenger_type: z
            .enum(['escort', 'pca', 'guest'])
            .optional()
            .describe('Type of additional passenger: escort (companion), pca (personal care attendant), or guest. NOTE: Adding passengers may fail with new addresses due to a DATS system limitation. If booking fails, try without a passenger and contact DATS to add one.'),
          additional_passenger_count: z
            .number()
            .int()
            .min(1)
            .max(3)
            .optional()
            .describe('Number of additional passengers (1-3)'),
        },
        async (params) => {
          try {
            // Check for valid session
            const session = await deps.getValidSession(params.session_id);
            if (!session) {
              return createErrorResponse({
                category: ErrorCategory.CREDENTIALS_NOT_FOUND,
                message:
                  'Your session has expired or you have not connected your DATS account yet. Would you like me to open the secure login page? (Use the connect_account tool)',
                recoverable: true,
              });
            }

            // Parse flexible date (handles "thursday", "tomorrow", etc.)
            const timezone = params.timezone || 'America/Edmonton';
            const parsedPickupDate = parseFlexibleDate(params.pickup_date, timezone);

            // Log the date parsing for debugging
            if (params.pickup_date !== parsedPickupDate) {
              logger.info(`Date parsing: "${params.pickup_date}" -> "${parsedPickupDate}" (timezone: ${timezone})`);
            }

            // Trust DATS API to validate booking window
            // DATS will return proper error if booking doesn't meet requirements
            logger.info('Using session for trip booking');
            const api = new DATSApi({ sessionCookie: session.sessionCookie });

            const bookingDetails = {
              pickupDate: parsedPickupDate,
              pickupTime: params.pickup_time,
              pickupAddress: params.pickup_address,
              destinationAddress: params.destination_address,
              mobilityDevice: params.mobility_device as MobilityDevice,
              companion: params.companion,
              returnTrip: params.return_trip,
              pickupPhone: params.pickup_phone,
              dropoffPhone: params.dropoff_phone,
              pickupComments: params.pickup_comments,
              dropoffComments: params.dropoff_comments,
              additionalPassenger: params.additional_passenger_type
                ? {
                    type: params.additional_passenger_type as 'escort' | 'pca' | 'guest',
                    count: params.additional_passenger_count,
                  }
                : undefined,
            };

            // Use the correct 3-step booking flow
            logger.info('Starting 3-step booking flow');
            const result = await api.bookTrip(session.clientId, bookingDetails);

            // Generate plain language confirmation for the user
            const userMessage = formatBookingConfirmation(result);

            const responseData = { ...result, userMessage };

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(responseData, null, 2),
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
