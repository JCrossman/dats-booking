#!/usr/bin/env node
/**
 * DATS Booking MCP Server
 *
 * Provides tools for booking Edmonton DATS trips via natural language.
 * Supports both local (stdio) and remote (HTTP) transport modes.
 *
 * SECURITY: Uses web-based authentication flow.
 * - Users enter credentials in a secure browser page
 * - Credentials NEVER touch Claude or Anthropic systems
 * - Only session cookies are stored (encrypted locally or in Cosmos DB)
 *
 * TRANSPORT MODES:
 * - stdio (default): Local mode for Claude Desktop, sessions stored locally
 * - http: Remote mode for Claude mobile/web, sessions stored in Cosmos DB
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { SessionManager } from './auth/session-manager.js';
import { CosmosSessionStore } from './auth/cosmos-session-store.js';
import {
  initiateWebAuth,
  initiateWebAuthRemote,
  pollAuthResultRemote,
  isWebAuthAvailable,
} from './auth/web-auth.js';
import { createHttpServer, startHttpServer } from './server/http-server.js';
import { DATSApi } from './api/dats-api.js';
import { ErrorCategory, TRIP_STATUSES, type MobilityDevice, type TripStatusCode } from './types.js';
import { wrapError, createErrorResponse } from './utils/errors.js';
import { logger } from './utils/logger.js';
import { validateBookingWindow, validateCancellation } from './utils/booking-validation.js';
import {
  formatBookingConfirmation,
  formatCancellationConfirmation,
  formatTripsForUser,
  formatAvailabilityForUser,
  PLAIN_LANGUAGE_GUIDELINES,
} from './utils/plain-language.js';

// ============= TRANSPORT MODE CONFIGURATION =============

/**
 * Transport mode: 'stdio' for local, 'http' for remote
 */
const TRANSPORT_MODE = (process.env.MCP_TRANSPORT || 'stdio') as 'stdio' | 'http';
const HTTP_PORT = parseInt(process.env.PORT || '3000', 10);
const HTTP_HOST = process.env.HOST || '0.0.0.0';

/**
 * Parse a date string that can be either YYYY-MM-DD or a relative date like "Thursday"
 * Uses the specified timezone for calculations (defaults to America/Edmonton for DATS users)
 */
function parseFlexibleDate(dateStr: string, timezone: string = 'America/Edmonton'): string {
  // If already in YYYY-MM-DD format, return as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }

  // Get current date in the user's timezone
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const [year, month, day] = formatter.format(now).split('-').map(Number);

  // Create a date object representing "today" in user's timezone
  const today = new Date(year, month - 1, day);
  const currentDayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday

  const input = dateStr.toLowerCase().trim();

  // Handle relative date keywords
  if (input === 'today') {
    return formatDateYMD(today);
  }
  if (input === 'tomorrow') {
    today.setDate(today.getDate() + 1);
    return formatDateYMD(today);
  }
  if (input === 'yesterday') {
    today.setDate(today.getDate() - 1);
    return formatDateYMD(today);
  }

  // Handle day names (find next occurrence)
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayIndex = dayNames.indexOf(input);
  if (dayIndex !== -1) {
    // Calculate days until the target day
    let daysUntil = dayIndex - currentDayOfWeek;
    if (daysUntil <= 0) {
      daysUntil += 7; // Move to next week if today or past
    }
    today.setDate(today.getDate() + daysUntil);
    return formatDateYMD(today);
  }

  // Handle "next <day>"
  const nextDayMatch = input.match(/^next\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/);
  if (nextDayMatch) {
    const targetDay = dayNames.indexOf(nextDayMatch[1]);
    let daysUntil = targetDay - currentDayOfWeek;
    if (daysUntil <= 0) {
      daysUntil += 7;
    }
    today.setDate(today.getDate() + daysUntil);
    return formatDateYMD(today);
  }

  // If we can't parse it, return as-is (will fail validation if invalid)
  return dateStr;
}

function formatDateYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Get current date info for the response (helps Claude understand context)
 */
function getCurrentDateInfo(timezone: string = 'America/Edmonton'): { today: string; dayOfWeek: string } {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const dayFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'long',
  });
  return {
    today: formatter.format(now),
    dayOfWeek: dayFormatter.format(now),
  };
}

/**
 * Check if running in remote (HTTP) mode
 */
function isRemoteMode(): boolean {
  return TRANSPORT_MODE === 'http';
}

// ============= SERVER AND SESSION STORES =============

const server = new McpServer({
  name: 'dats-booking',
  version: '1.0.0',
});

// Local session manager (used in stdio mode)
const sessionManager = new SessionManager();

// Remote session store (used in HTTP mode) - lazy initialized
let cosmosSessionStore: CosmosSessionStore | null = null;

function getCosmosStore(): CosmosSessionStore {
  if (!cosmosSessionStore) {
    cosmosSessionStore = new CosmosSessionStore();
  }
  return cosmosSessionStore;
}

// ============= SESSION VALIDATION =============

/**
 * Check if session is valid by attempting to use it
 * Returns the session if valid, null if expired/invalid
 *
 * @param sessionId - Required for remote mode, optional for local mode
 */
async function getValidSession(
  sessionId?: string
): Promise<{ sessionCookie: string; clientId: string } | null> {
  // Remote mode: use Cosmos DB session store
  if (isRemoteMode()) {
    if (!sessionId) {
      return null;
    }

    try {
      const session = await getCosmosStore().retrieve(sessionId);
      if (!session) {
        return null;
      }

      // Validate session with DATS API
      const api = new DATSApi({ sessionCookie: session.sessionCookie });
      await api.getClientInfo(session.clientId);

      // Refresh TTL on successful use
      await getCosmosStore().refresh(sessionId);

      return {
        sessionCookie: session.sessionCookie,
        clientId: session.clientId,
      };
    } catch {
      // Session invalid - delete from store
      await getCosmosStore().delete(sessionId);
      return null;
    }
  }

  // Local mode: use file-based session manager
  if (!sessionManager.hasSession()) {
    return null;
  }

  try {
    const session = await sessionManager.retrieve();

    // Try to use the session by making a simple API call
    const api = new DATSApi({ sessionCookie: session.sessionCookie });

    // Attempt to get client info as a session validity check
    await api.getClientInfo(session.clientId);

    return {
      sessionCookie: session.sessionCookie,
      clientId: session.clientId,
    };
  } catch (error) {
    // Session is invalid or expired
    logger.info('Session expired or invalid');
    await sessionManager.clear();
    return null;
  }
}

// ============= TOOL: connect_account =============

server.tool(
  'connect_account',
  `Connect your DATS account securely. Call this first before using other tools.

HOW IT WORKS:
1. A secure webpage opens in your browser (or you'll receive a URL to open)
2. You enter your DATS client ID and passcode there (not in this chat)
3. Once connected, close the browser and come back here

PRIVACY: Your credentials are NEVER stored or sent to Claude. They go directly from your browser to DATS. Only a temporary session token is saved.

Use this tool when:
- Setting up DATS booking for the first time
- Your session has expired (typically daily)
- You want to reconnect your account

REMOTE MODE: If using Claude mobile or web, you will receive a URL to open in your browser. Authentication happens in the background - just come back here when done.`,
  {},
  async () => {
    try {
      // Check if Azure auth endpoint is available
      const authAvailable = await isWebAuthAvailable();
      if (!authAvailable) {
        return createErrorResponse({
          category: ErrorCategory.NETWORK_ERROR,
          message:
            'The secure login page is not available. Please check your internet connection and try again.',
          recoverable: true,
        });
      }

      // Remote mode: Return URL for user to open (can't open browser on server)
      if (isRemoteMode()) {
        const authInit = initiateWebAuthRemote();

        // Start background polling - session will be stored automatically when auth completes
        // This runs in the background while user authenticates
        pollAuthResultRemote(authInit.sessionId)
          .then(async (result) => {
            if (result.success && result.sessionCookie && result.clientId) {
              // Store session in Cosmos DB - will be ready when user returns
              await getCosmosStore().store(authInit.sessionId, {
                sessionCookie: result.sessionCookie,
                clientId: result.clientId,
                createdAt: new Date().toISOString(),
              });
              logger.info(`Background auth completed for session: ${authInit.sessionId.substring(0, 8)}...`);
            } else {
              logger.warn(`Background auth failed for session: ${authInit.sessionId.substring(0, 8)}... - ${result.error}`);
            }
          })
          .catch((err) => {
            logger.error(`Background polling error: ${err}`);
          });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  action: 'open_url',
                  authUrl: authInit.authUrl,
                  sessionId: authInit.sessionId,
                  instructions:
                    'Open this URL to connect your DATS account. Enter your client ID and passcode on the secure page. ' +
                    'The page will close automatically when done. Come back here and your session will be ready.',
                  forAssistant:
                    'After the user says they have connected, immediately retry their original request using the session_id above. ' +
                    'Do NOT ask them to do anything else - just proceed with what they originally asked for.',
                },
                null,
                2
              ),
            },
          ],
        };
      }

      // Local mode: Open browser and wait for auth
      await sessionManager.migrateFromCredentials();

      logger.info('Starting web authentication flow');
      const result = await initiateWebAuth();

      if (!result.success || !result.sessionCookie || !result.clientId) {
        return createErrorResponse({
          category: ErrorCategory.AUTH_FAILURE,
          message: result.error || 'Could not connect to your DATS account. Please try again.',
          recoverable: true,
        });
      }

      // Store the session (encrypted)
      await sessionManager.store({
        sessionCookie: result.sessionCookie,
        clientId: result.clientId,
        createdAt: new Date().toISOString(),
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message:
                  'Your DATS account is connected! Your credentials were NOT stored - only a temporary session token. You can now book trips, view upcoming trips, and more. Your session will expire when DATS invalidates it (typically daily).',
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

// ============= TOOL: complete_connection (Remote mode only) =============

server.tool(
  'complete_connection',
  `Complete the connection process after authenticating in your browser.

REMOTE MODE ONLY: This tool is usually NOT needed - connect_account now polls automatically in the background.
Only use this if the automatic polling timed out or you need to manually complete an old session.`,
  {
    session_id: z
      .string()
      .uuid()
      .describe('The session_id returned by connect_account'),
  },
  async ({ session_id }) => {
    try {
      // This tool only makes sense in remote mode, but handle gracefully
      if (!isRemoteMode()) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: false,
                  message:
                    'This tool is only needed in remote mode. In local mode, connect_account handles everything.',
                },
                null,
                2
              ),
            },
          ],
        };
      }

      logger.info(`Completing connection for session: ${session_id.substring(0, 8)}...`);

      // Poll for authentication result
      const result = await pollAuthResultRemote(session_id);

      if (!result.success || !result.sessionCookie || !result.clientId) {
        return createErrorResponse({
          category: ErrorCategory.AUTH_FAILURE,
          message: result.error || 'Authentication did not complete. Please try again.',
          recoverable: true,
        });
      }

      // Store in Cosmos DB
      await getCosmosStore().store(session_id, {
        sessionCookie: result.sessionCookie,
        clientId: result.clientId,
        createdAt: new Date().toISOString(),
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                sessionId: session_id,
                message:
                  'Your DATS account is connected! You can now book trips, view upcoming trips, and more. ' +
                  'Include the session_id in future requests to stay connected.',
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

// ============= TOOL: disconnect_account =============

server.tool(
  'disconnect_account',
  `Log out of your DATS account and clear your session.

Use this tool when:
- You want to log out for security reasons
- You want to switch to a different DATS account
- You are done using DATS booking

After disconnecting, you will need to use connect_account to log in again.

REMOTE MODE: Include session_id to disconnect a specific session.`,
  {
    session_id: z
      .string()
      .uuid()
      .optional()
      .describe('Session ID to disconnect (required for remote mode)'),
  },
  async ({ session_id }) => {
    try {
      // Remote mode: delete from Cosmos DB
      if (isRemoteMode()) {
        if (!session_id) {
          return createErrorResponse({
            category: ErrorCategory.VALIDATION_ERROR,
            message: 'session_id is required to disconnect in remote mode.',
            recoverable: true,
          });
        }

        const hadSession = await getCosmosStore().hasSession(session_id);
        await getCosmosStore().delete(session_id);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  message: hadSession
                    ? 'You have been logged out. Your session has been cleared. To use DATS booking again, you will need to connect your account.'
                    : 'Session not found or already expired.',
                },
                null,
                2
              ),
            },
          ],
        };
      }

      // Local mode: clear file-based session
      const hadSession = sessionManager.hasSession();
      await sessionManager.clear();

      if (hadSession) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  message:
                    'You have been logged out. Your session has been cleared from this computer. To use DATS booking again, you will need to connect your account.',
                },
                null,
                2
              ),
            },
          ],
        };
      } else {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  message: 'You were not logged in. No session to clear.',
                },
                null,
                2
              ),
            },
          ],
        };
      }
    } catch (error) {
      const datsError = wrapError(error);
      return createErrorResponse(datsError.toToolError());
    }
  }
);

// ============= TOOL: book_trip =============

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
      const session = await getValidSession(params.session_id);
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

      // Validate booking window against DATS business rules
      const validation = validateBookingWindow(parsedPickupDate, params.pickup_time);

      if (!validation.valid) {
        return createErrorResponse({
          category: ErrorCategory.BUSINESS_RULE_VIOLATION,
          message: validation.error || 'Booking does not meet DATS requirements.',
          recoverable: true,
        });
      }

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

      // Include validation warning in response if present (e.g., same-day booking notice)
      const responseData = validation.warning
        ? { ...result, warning: validation.warning, userMessage }
        : { ...result, userMessage };

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

// ============= TOOL: get_trips =============

server.tool(
  'get_trips',
  `Retrieve DATS trips. By default shows only active trips (Scheduled, Unscheduled, Arrived, Pending).

DATE FORMATS ACCEPTED:
- YYYY-MM-DD (e.g., "2026-01-15")
- Day names: "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"
- Relative: "today", "tomorrow"
- Next week: "next monday", "next tuesday", etc.

When user says "Thursday", pass "thursday" directly - the server will calculate the correct date.

TRIP DATA INCLUDES:
- Date, pickup window, pickup/destination addresses
- Status (Scheduled, Performed, Cancelled, etc.)
- Mobility device, passengers, phone numbers, fare

FILTERING OPTIONS:
- By default: Only active trips (Scheduled, Unscheduled, Arrived, Pending)
- include_all: true - Show ALL trips including Performed, Cancelled, No Show, etc.
- status_filter: Filter to specific status(es) like ["Pf"] for Performed only

STATUS CODES:
- S = Scheduled, U = Unscheduled, A = Arrived, Pn = Pending
- Pf = Performed, CA = Cancelled, NS = No Show, NM = Missed, R = Refused

The response includes a "userMessage" field with trips formatted as a markdown table.
You should display this userMessage to the user as-is.

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
      const session = await getValidSession(session_id);
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
        // Default: only show active trips (Scheduled, Unscheduled, Arrived, Pending)
        trips = trips.filter(trip => {
          const statusInfo = TRIP_STATUSES[trip.status as TripStatusCode];
          return statusInfo?.isActive ?? true;
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

// ============= TOOL: check_availability =============

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
      const session = await getValidSession(session_id);
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

// ============= TOOL: cancel_trip =============

server.tool(
  'cancel_trip',
  `Cancel an existing DATS booking. Requires 2-hour minimum notice. IMPORTANT: Before calling this tool, always confirm with the user by summarizing the trip details (date, time, pickup, destination) and explicitly asking "Are you sure you want to cancel this trip?" Only proceed after user confirms. You can use either the numeric booking ID or the alphanumeric confirmation number.

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
      const session = await getValidSession(session_id);
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

      // Validate 2-hour cancellation notice requirement
      const cancellationValidation = validateCancellation(
        matchingTrip.date,
        matchingTrip.pickupWindow.start
      );

      if (!cancellationValidation.valid) {
        return createErrorResponse({
          category: ErrorCategory.BUSINESS_RULE_VIOLATION,
          message: cancellationValidation.error || 'Cannot cancel this trip due to DATS policies.',
          recoverable: false,
        });
      }

      const result = await api.cancelTrip(session.clientId, bookingId);

      // Generate plain language confirmation for the user
      const userMessage = formatCancellationConfirmation(result.success, result.message);

      // Include warning in response if present (e.g., cutting it close to 2-hour window)
      const responseData = cancellationValidation.warning
        ? { ...result, warning: cancellationValidation.warning, userMessage }
        : { ...result, userMessage };

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

// ============= TOOL: get_announcements =============

server.tool(
  'get_announcements',
  `Get DATS system announcements and important notices for clients.

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
      const session = await getValidSession(session_id);
      if (!session) {
        return createErrorResponse({
          category: ErrorCategory.CREDENTIALS_NOT_FOUND,
          message:
            'Your session has expired or you have not connected your DATS account yet. Would you like me to open the secure login page? (Use the connect_account tool)',
          recoverable: true,
        });
      }

      logger.info('Fetching DATS announcements');
      const api = new DATSApi({ sessionCookie: session.sessionCookie });
      const announcements = await api.getAnnouncements();

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true, announcements }, null, 2),
          },
        ],
      };
    } catch (error) {
      const datsError = wrapError(error);
      return createErrorResponse(datsError.toToolError());
    }
  }
);

// ============= TOOL: get_profile =============

server.tool(
  'get_profile',
  `Get your DATS client profile including personal info, contact details, and mobility aids.

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
      const session = await getValidSession(session_id);
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
      const [clientInfo, contactInfo, savedLocations] = await Promise.all([
        api.getClientInfo(session.clientId),
        api.getContactInfo(session.clientId),
        api.getSavedLocations(session.clientId),
      ]);

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

// ============= TOOL: get_info =============

server.tool(
  'get_info',
  'Get DATS general information including service description, fares, and privacy policy.',
  {
    topic: z
      .enum(['general', 'fares', 'privacy', 'service', 'all'])
      .optional()
      .describe('Specific topic to retrieve (defaults to all)'),
  },
  async ({ topic = 'all' }) => {
    try {
      const baseUrl = 'https://datsonlinebooking.edmonton.ca/Public/Paratransit/HTML/general-information';

      const topics: Record<string, { url: string; title: string }> = {
        general: { url: `${baseUrl}/general-info-view-en.html`, title: 'General Information' },
        fares: { url: `${baseUrl}/fares-view-en.html`, title: 'Fares' },
        privacy: { url: `${baseUrl}/privacy-view-en.html`, title: 'Privacy Policy' },
        service: { url: `${baseUrl}/service-description-view-en.html`, title: 'Service Description' },
      };

      const fetchTopic = async (key: string): Promise<{ title: string; content: string }> => {
        const { url, title } = topics[key];
        try {
          const response = await fetch(url);
          if (!response.ok) {
            return { title, content: `Failed to load ${title}` };
          }
          const html = await response.text();
          // Strip HTML tags for cleaner output
          const textContent = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          return { title, content: textContent };
        } catch {
          return { title, content: `Error loading ${title}` };
        }
      };

      let result: Record<string, { title: string; content: string }>;

      if (topic === 'all') {
        const results = await Promise.all(
          Object.keys(topics).map(async (key) => ({
            key,
            data: await fetchTopic(key),
          }))
        );
        result = Object.fromEntries(results.map(({ key, data }) => [key, data]));
      } else {
        result = { [topic]: await fetchTopic(topic) };
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true, info: result }, null, 2),
          },
        ],
      };
    } catch (error) {
      const datsError = wrapError(error);
      return createErrorResponse(datsError.toToolError());
    }
  }
);

// ============= MAIN =============

/**
 * Start the MCP server in stdio mode (local, for Claude Desktop)
 */
async function startStdioServer(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info('DATS Booking MCP Server running on stdio');
  logger.info(`Session available: ${sessionManager.hasSession()}`);
}

/**
 * Start the MCP server in HTTP mode (remote, for Claude mobile/web)
 */
async function startRemoteServer(): Promise<void> {
  logger.info('Starting DATS Booking MCP Server in HTTP mode');

  const app = createHttpServer(server);
  await startHttpServer(app, HTTP_PORT, HTTP_HOST);
}

/**
 * Main entry point - starts appropriate server based on transport mode
 */
async function main(): Promise<void> {
  logger.info(`Transport mode: ${TRANSPORT_MODE}`);

  if (TRANSPORT_MODE === 'http') {
    await startRemoteServer();
  } else {
    await startStdioServer();
  }
}

main().catch((error) => {
  logger.error('Fatal error', error instanceof Error ? error : undefined);
  process.exit(1);
});
