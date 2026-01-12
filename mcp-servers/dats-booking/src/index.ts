#!/usr/bin/env node
/**
 * DATS Booking MCP Server
 *
 * Provides tools for booking Edmonton DATS trips via natural language.
 *
 * SECURITY: Uses web-based authentication flow.
 * - Users enter credentials in a secure browser page
 * - Credentials NEVER touch Claude or Anthropic systems
 * - Only session cookies are stored locally (encrypted)
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { SessionManager } from './auth/session-manager.js';
import { initiateWebAuth, isWebAuthAvailable } from './auth/web-auth.js';
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

const server = new McpServer({
  name: 'dats-booking',
  version: '1.0.0',
});

const sessionManager = new SessionManager();

/**
 * Check if session is valid by attempting to use it
 * Returns the session if valid, null if expired/invalid
 */
async function getValidSession(): Promise<{ sessionCookie: string; clientId: string } | null> {
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
1. A secure webpage opens in your browser
2. You enter your DATS client ID and passcode there (not in this chat)
3. Once connected, close the browser and come back here

PRIVACY: Your credentials are NEVER stored or sent to Claude. They go directly from your browser to DATS. Only a temporary session token is saved on your computer.

Use this tool when:
- Setting up DATS booking for the first time
- Your session has expired (typically daily)
- You want to reconnect your account`,
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

      // Migrate from old credentials.enc if exists
      await sessionManager.migrateFromCredentials();

      // Initiate web-based authentication
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

// ============= TOOL: disconnect_account =============

server.tool(
  'disconnect_account',
  `Log out of your DATS account and clear your session.

Use this tool when:
- You want to log out for security reasons
- You want to switch to a different DATS account
- You are done using DATS booking

After disconnecting, you will need to use connect_account to log in again.`,
  {},
  async () => {
    try {
      const hadSession = sessionManager.hasSession();

      // Clear the stored session
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

IMPORTANT: Before calling this tool, always confirm with the user by summarizing the booking details (date, time, pickup address, destination, and any special options like mobility device or companions) and explicitly asking "Do you want me to book this trip?" Only proceed after user confirms.

The response includes a "userMessage" field with pre-formatted plain language confirmation.
You should display this userMessage to the user as-is.

${PLAIN_LANGUAGE_GUIDELINES}`,
  {
    pickup_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .describe('Pickup date in YYYY-MM-DD format'),
    pickup_time: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .describe('Desired pickup time in HH:MM 24-hour format'),
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
      const session = await getValidSession();
      if (!session) {
        return createErrorResponse({
          category: ErrorCategory.CREDENTIALS_NOT_FOUND,
          message:
            'Your session has expired or you have not connected your DATS account yet. Would you like me to open the secure login page? (Use the connect_account tool)',
          recoverable: true,
        });
      }

      // Validate booking window against DATS business rules
      const validation = validateBookingWindow(params.pickup_date, params.pickup_time);

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
        pickupDate: params.pickup_date,
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
  `Retrieve upcoming booked DATS trips. Cancelled trips are hidden by default.

TRIP DATA INCLUDES:
- Date, pickup window, pickup/destination addresses
- Mobility device type (wheelchair, scooter, ambulatory)
- Additional passengers (escort, PCA, guest) with count
- Pickup/dropoff phone numbers and comments
- Fare amount

The response includes a "userMessage" field with pre-formatted plain language text.
You should display this userMessage to the user as-is.

${PLAIN_LANGUAGE_GUIDELINES}`,
  {
    date_from: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .describe('Start date filter (YYYY-MM-DD). Defaults to today.'),
    date_to: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .describe('End date filter (YYYY-MM-DD). Defaults to 7 days from now.'),
    include_cancelled: z
      .boolean()
      .optional()
      .describe('Set to true to include cancelled trips. Defaults to false.'),
  },
  async ({ date_from, date_to, include_cancelled = false }) => {
    try {
      // Check for valid session
      const session = await getValidSession();
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

      // Convert date format if provided (YYYY-MM-DD to YYYYMMDD)
      const fromDate = date_from ? date_from.replace(/-/g, '') : undefined;
      const toDate = date_to ? date_to.replace(/-/g, '') : undefined;

      let trips = await api.getClientTrips(session.clientId, fromDate, toDate);

      // Filter out inactive trips (cancelled, performed, no-show, etc.) by default
      if (!include_cancelled) {
        trips = trips.filter(trip => {
          const statusInfo = TRIP_STATUSES[trip.status as TripStatusCode];
          return statusInfo?.isActive ?? true;
        });
      }

      // Generate plain language summary for the user
      const userMessage = formatTripsForUser(trips);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true, trips, userMessage }, null, 2),
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

Use this tool to help users find when they can book a trip. You can:
- Get all available booking dates (up to 3 days ahead)
- Get the time window for a specific date

The response includes a "userMessage" field with pre-formatted plain language text.
You should display this userMessage to the user as-is.

${PLAIN_LANGUAGE_GUIDELINES}`,
  {
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .describe('Optional: specific date to check times for (YYYY-MM-DD format). If not provided, returns all available dates.'),
  },
  async ({ date }) => {
    try {
      // Check for valid session
      const session = await getValidSession();
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

      // If a specific date was requested, get the time window for that date
      if (date) {
        // Convert YYYY-MM-DD to YYYYMMDD for API
        const apiDate = date.replace(/-/g, '');
        timeWindow = await api.getBookingTimesWindow(session.clientId, apiDate);
      }

      // Generate plain language summary
      const userMessage = formatAvailabilityForUser(availableDates, timeWindow, date);

      const result = {
        success: true,
        availableDates,
        ...(date && timeWindow ? { requestedDate: date, timeWindow } : {}),
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
  'Cancel an existing DATS booking. Requires 2-hour minimum notice. IMPORTANT: Before calling this tool, always confirm with the user by summarizing the trip details (date, time, pickup, destination) and explicitly asking "Are you sure you want to cancel this trip?" Only proceed after user confirms. You can use either the numeric booking ID or the alphanumeric confirmation number.',
  {
    confirmation_number: z
      .string()
      .min(1)
      .describe('The DATS booking ID (numeric like 18789348) or confirmation number (alphanumeric like T011EBCA7)'),
  },
  async ({ confirmation_number }) => {
    try {
      // Check for valid session
      const session = await getValidSession();
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
  'Get DATS system announcements and important notices for clients.',
  {},
  async () => {
    try {
      // Check for valid session
      const session = await getValidSession();
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
  'Get your DATS client profile including personal info, contact details, and mobility aids.',
  {},
  async () => {
    try {
      // Check for valid session
      const session = await getValidSession();
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

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info('DATS Booking MCP Server running on stdio');
  logger.info(`Session available: ${sessionManager.hasSession()}`);
}

main().catch((error) => {
  logger.error('Fatal error', error instanceof Error ? error : undefined);
  process.exit(1);
});
