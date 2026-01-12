#!/usr/bin/env node
/**
 * DATS Booking MCP Server
 *
 * Provides tools for booking Edmonton DATS trips via natural language.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { CredentialManager } from './auth/credential-manager.js';
import { AuthClient } from './api/auth-client.js';
import { DATSApi } from './api/dats-api.js';
import { ErrorCategory, type MobilityDevice } from './types.js';
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

const credentialManager = new CredentialManager();

// ============= TOOL: setup_credentials =============

server.tool(
  'setup_credentials',
  `Store encrypted DATS credentials for booking automation. Call this first before using other tools.

PRIVACY NOTICE: When you provide your credentials in this chat:
- They will be encrypted and stored locally on your computer (~/.dats-booking/)
- They will be visible in this conversation history
- They are transmitted through Claude's servers to reach this tool

RECOMMENDATION: After setting up your credentials, consider starting a new conversation to keep your credentials out of your chat history.`,
  {
    client_id: z.string().min(1).describe('Your DATS client ID number'),
    passcode: z.string().min(1).describe('Your DATS passcode/password'),
  },
  async ({ client_id, passcode }) => {
    try {
      await credentialManager.store({
        clientId: client_id,
        passcode: passcode,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message:
                  'Credentials stored securely and encrypted on your computer. You can now use book_trip, get_trips, check_availability, and cancel_trip. For privacy, consider starting a new conversation so your credentials are not in your chat history.',
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
      if (!credentialManager.hasCredentials()) {
        return createErrorResponse({
          category: ErrorCategory.CREDENTIALS_NOT_FOUND,
          message: 'No credentials found. Please call setup_credentials first.',
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

      const credentials = await credentialManager.retrieve();

      // Use fast direct API instead of browser automation
      logger.info('Using direct API for trip booking');
      const loginResult = await AuthClient.login({
        username: credentials.clientId,
        password: credentials.passcode,
      });

      if (!loginResult.success || !loginResult.sessionCookie || !loginResult.clientId) {
        return createErrorResponse({
          category: ErrorCategory.AUTH_FAILURE,
          message: loginResult.error || 'Failed to authenticate with DATS',
          recoverable: true,
        });
      }

      const api = new DATSApi({ sessionCookie: loginResult.sessionCookie });

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
      const result = await api.bookTrip(loginResult.clientId, bookingDetails);

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
      if (!credentialManager.hasCredentials()) {
        return createErrorResponse({
          category: ErrorCategory.CREDENTIALS_NOT_FOUND,
          message: 'No credentials found. Please call setup_credentials first.',
          recoverable: true,
        });
      }

      const credentials = await credentialManager.retrieve();

      // Use fast direct API instead of browser automation
      logger.info('Using direct API for trip retrieval');
      const loginResult = await AuthClient.login({
        username: credentials.clientId,
        password: credentials.passcode,
      });

      if (!loginResult.success || !loginResult.sessionCookie || !loginResult.clientId) {
        return createErrorResponse({
          category: ErrorCategory.AUTH_FAILURE,
          message: loginResult.error || 'Failed to authenticate with DATS',
          recoverable: true,
        });
      }

      const api = new DATSApi({ sessionCookie: loginResult.sessionCookie });

      // Convert date format if provided (YYYY-MM-DD to YYYYMMDD)
      const fromDate = date_from ? date_from.replace(/-/g, '') : undefined;
      const toDate = date_to ? date_to.replace(/-/g, '') : undefined;

      let trips = await api.getClientTrips(loginResult.clientId, fromDate, toDate);

      // Filter out cancelled trips by default
      if (!include_cancelled) {
        trips = trips.filter(trip => trip.status !== 'cancelled');
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
      if (!credentialManager.hasCredentials()) {
        return createErrorResponse({
          category: ErrorCategory.CREDENTIALS_NOT_FOUND,
          message: 'No credentials found. Please call setup_credentials first.',
          recoverable: true,
        });
      }

      const credentials = await credentialManager.retrieve();

      logger.info('Checking booking availability');
      const loginResult = await AuthClient.login({
        username: credentials.clientId,
        password: credentials.passcode,
      });

      if (!loginResult.success || !loginResult.sessionCookie || !loginResult.clientId) {
        return createErrorResponse({
          category: ErrorCategory.AUTH_FAILURE,
          message: loginResult.error || 'Failed to authenticate with DATS',
          recoverable: true,
        });
      }

      const api = new DATSApi({ sessionCookie: loginResult.sessionCookie });

      // Always get available dates
      const availableDates = await api.getBookingDaysWindow(loginResult.clientId);

      let timeWindow: { earliest: string; latest: string } | undefined;

      // If a specific date was requested, get the time window for that date
      if (date) {
        // Convert YYYY-MM-DD to YYYYMMDD for API
        const apiDate = date.replace(/-/g, '');
        timeWindow = await api.getBookingTimesWindow(loginResult.clientId, apiDate);
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
      if (!credentialManager.hasCredentials()) {
        return createErrorResponse({
          category: ErrorCategory.CREDENTIALS_NOT_FOUND,
          message: 'No credentials found. Please call setup_credentials first.',
          recoverable: true,
        });
      }

      const credentials = await credentialManager.retrieve();

      // Use fast direct API instead of browser automation
      logger.info('Using direct API for trip cancellation');
      const loginResult = await AuthClient.login({
        username: credentials.clientId,
        password: credentials.passcode,
      });

      if (!loginResult.success || !loginResult.sessionCookie || !loginResult.clientId) {
        return createErrorResponse({
          category: ErrorCategory.AUTH_FAILURE,
          message: loginResult.error || 'Failed to authenticate with DATS',
          recoverable: true,
        });
      }

      const api = new DATSApi({ sessionCookie: loginResult.sessionCookie });

      // Always look up the trip to get date/time for validation
      logger.info(`Looking up trip for: ${confirmation_number}`);
      const trips = await api.getClientTrips(loginResult.clientId);
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

      const result = await api.cancelTrip(loginResult.clientId, bookingId);

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
      if (!credentialManager.hasCredentials()) {
        return createErrorResponse({
          category: ErrorCategory.CREDENTIALS_NOT_FOUND,
          message: 'No credentials found. Please call setup_credentials first.',
          recoverable: true,
        });
      }

      const credentials = await credentialManager.retrieve();

      logger.info('Fetching DATS announcements');
      const loginResult = await AuthClient.login({
        username: credentials.clientId,
        password: credentials.passcode,
      });

      if (!loginResult.success || !loginResult.sessionCookie) {
        return createErrorResponse({
          category: ErrorCategory.AUTH_FAILURE,
          message: loginResult.error || 'Failed to authenticate with DATS',
          recoverable: true,
        });
      }

      const api = new DATSApi({ sessionCookie: loginResult.sessionCookie });
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
      if (!credentialManager.hasCredentials()) {
        return createErrorResponse({
          category: ErrorCategory.CREDENTIALS_NOT_FOUND,
          message: 'No credentials found. Please call setup_credentials first.',
          recoverable: true,
        });
      }

      const credentials = await credentialManager.retrieve();

      logger.info('Fetching DATS client profile');
      const loginResult = await AuthClient.login({
        username: credentials.clientId,
        password: credentials.passcode,
      });

      if (!loginResult.success || !loginResult.sessionCookie || !loginResult.clientId) {
        return createErrorResponse({
          category: ErrorCategory.AUTH_FAILURE,
          message: loginResult.error || 'Failed to authenticate with DATS',
          recoverable: true,
        });
      }

      const api = new DATSApi({ sessionCookie: loginResult.sessionCookie });

      // Get both client info and contact info
      const [clientInfo, contactInfo, savedLocations] = await Promise.all([
        api.getClientInfo(loginResult.clientId),
        api.getContactInfo(loginResult.clientId),
        api.getSavedLocations(loginResult.clientId),
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
  logger.info(`Credentials configured: ${credentialManager.hasCredentials()}`);
}

main().catch((error) => {
  logger.error('Fatal error', error instanceof Error ? error : undefined);
  process.exit(1);
});
