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
import { browserManager } from './automation/browser-manager.js';
import { LoginPage } from './automation/pages/login-page.js';
import { BookingPage } from './automation/pages/booking-page.js';
import { TripsPage } from './automation/pages/trips-page.js';
import { ErrorCategory, type MobilityDevice } from './types.js';
import { wrapError, createErrorResponse } from './utils/errors.js';
import { logger } from './utils/logger.js';

const server = new McpServer({
  name: 'dats-booking',
  version: '1.0.0',
});

const credentialManager = new CredentialManager();

// ============= TOOL: setup_credentials =============

server.tool(
  'setup_credentials',
  'Store encrypted DATS credentials for booking automation. Call this first before using other tools.',
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
                  'Credentials stored securely. You can now use book_trip, get_trips, and cancel_trip.',
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
  'Create a new DATS booking. Requires credentials to be set up first.',
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

      const credentials = await credentialManager.retrieve();

      return await browserManager.withSession(async (session) => {
        const { page, rateLimiter } = session;

        const loginPage = new LoginPage(page, rateLimiter);
        await loginPage.login(credentials);

        const bookingPage = new BookingPage(page, rateLimiter);
        const result = await bookingPage.createBooking({
          pickupDate: params.pickup_date,
          pickupTime: params.pickup_time,
          pickupAddress: params.pickup_address,
          destinationAddress: params.destination_address,
          mobilityDevice: params.mobility_device as MobilityDevice,
          companion: params.companion,
          returnTrip: params.return_trip,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      });
    } catch (error) {
      const datsError = wrapError(error);
      return createErrorResponse(datsError.toToolError());
    }
  }
);

// ============= TOOL: get_trips =============

server.tool(
  'get_trips',
  'Retrieve upcoming booked DATS trips.',
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
  },
  async ({ date_from, date_to }) => {
    try {
      if (!credentialManager.hasCredentials()) {
        return createErrorResponse({
          category: ErrorCategory.CREDENTIALS_NOT_FOUND,
          message: 'No credentials found. Please call setup_credentials first.',
          recoverable: true,
        });
      }

      const credentials = await credentialManager.retrieve();

      return await browserManager.withSession(async (session) => {
        const { page, rateLimiter } = session;

        const loginPage = new LoginPage(page, rateLimiter);
        await loginPage.login(credentials);

        const tripsPage = new TripsPage(page, rateLimiter);
        const result = await tripsPage.getTrips(date_from, date_to);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      });
    } catch (error) {
      const datsError = wrapError(error);
      return createErrorResponse(datsError.toToolError());
    }
  }
);

// ============= TOOL: cancel_trip =============

server.tool(
  'cancel_trip',
  'Cancel an existing DATS booking. Requires 2-hour minimum notice.',
  {
    confirmation_number: z
      .string()
      .min(1)
      .describe('The DATS confirmation number to cancel'),
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

      return await browserManager.withSession(async (session) => {
        const { page, rateLimiter } = session;

        const loginPage = new LoginPage(page, rateLimiter);
        await loginPage.login(credentials);

        const tripsPage = new TripsPage(page, rateLimiter);
        const result = await tripsPage.cancelTrip(confirmation_number);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      });
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
