/**
 * cancel_trip Tool
 *
 * Cancels an existing DATS booking.
 * DATS API validates cancellation requirements (e.g., 2-hour minimum notice).
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
import { formatCancellationConfirmation } from '../utils/plain-language.js';
import type { ToolRegistration } from './types.js';

export interface CancelTripDependencies {
  sessionManager: SessionManager;
  getCosmosStore: () => CosmosSessionStore;
  isRemoteMode: () => boolean;
  getValidSession: (sessionId?: string) => Promise<{ sessionCookie: string; clientId: string } | null>;
}

export function createCancelTripTool(deps: CancelTripDependencies): ToolRegistration {
  return {
    register(server: McpServer) {
      server.tool(
        'cancel_trip',
        `Cancel an existing DATS booking. IMPORTANT: Before calling this tool, always confirm with the user by summarizing the trip details (date, time, pickup, destination) and explicitly asking "Are you sure you want to cancel this trip?" Only proceed after user confirms. You can use either the numeric booking ID or the alphanumeric confirmation number. DATS API will validate cancellation requirements (e.g., 2-hour minimum notice) and return an error if the trip cannot be cancelled.

REMOTE MODE: Include session_id from connect_account/complete_connection.`,
        {
          session_id: z
            .string()
            .uuid()
            .optional()
            .describe('Session ID (required for remote mode, optional for local)'),
          confirmation_number: z
            .string()
            .min(1)
            .describe('The DATS booking ID (numeric like 18789348) or confirmation number (alphanumeric like T011EBCA7)'),
        },
        async ({ session_id, confirmation_number }) => {
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

            logger.info('Using session for trip cancellation');
            const api = new DATSApi({ sessionCookie: session.sessionCookie });

            // Always look up the trip to get date/time for validation
            logger.info(`Looking up trip for: ${confirmation_number}`);
            const trips = await api.getClientTrips(session.clientId);
            const matchingTrip = trips.find(
              (t) =>
                t.confirmationNumber === confirmation_number ||
                t.bookingId === confirmation_number
            );

            if (!matchingTrip) {
              return createErrorResponse({
                category: ErrorCategory.VALIDATION_ERROR,
                message: `No trip found with confirmation number ${confirmation_number}. Please check the number and try again.`,
                recoverable: true,
              });
            }

            const bookingId = matchingTrip.bookingId;
            logger.info(`Found trip: ${bookingId} on ${matchingTrip.date}`);

            // Trust DATS API to determine if trip can be cancelled
            // DATS will return proper error if trip cannot be cancelled (e.g., < 2-hour notice)
            const result = await api.cancelTrip(session.clientId, bookingId);

            // Generate plain language confirmation for the user
            const userMessage = formatCancellationConfirmation(result.success, result.message);

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
