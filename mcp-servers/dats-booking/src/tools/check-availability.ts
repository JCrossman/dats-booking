/**
 * check_availability Tool
 *
 * Checks exact time slot availability for a specific route and date.
 * Returns available booking dates and exact 10-minute time slots.
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
import { parseFlexibleDate, getCurrentDateInfo } from '../helpers/date-helpers.js';
import type { ToolRegistration } from './types.js';

export interface CheckAvailabilityDependencies {
  sessionManager: SessionManager;
  getCosmosStore: () => CosmosSessionStore;
  isRemoteMode: () => boolean;
  getValidSession: (sessionId?: string) => Promise<{ sessionCookie: string; clientId: string } | null>;
}

/**
 * Convert seconds since midnight to human-readable time
 * @param seconds - Seconds since midnight (e.g., 23400 = 6:30 AM)
 * @returns Formatted time string (e.g., "6:30 AM")
 */
function secondsToTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

/**
 * Geocode an address using OpenStreetMap Nominatim API
 * @param address - Full address string
 * @returns Promise with lat/lon coordinates
 */
async function geocodeAddress(address: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://nominatim.openstreetmap.org/search?q=${encodedAddress}&format=json&limit=1`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'DATS-MCP-Server/1.0',
      },
    });

    const data = (await response.json()) as Array<{ lat: string; lon: string }>;

    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon),
      };
    }

    return null;
  } catch (error) {
    logger.error(`Failed to geocode address: ${address}`, error as Error);
    return null;
  }
}

export function createCheckAvailabilityTool(deps: CheckAvailabilityDependencies): ToolRegistration {
  return {
    register(server: McpServer) {
      server.tool(
        'check_availability',
        `Check exact time slot availability for a specific route and date.

Returns:
- Available booking dates (up to 3 days in advance)
- Exact time slots for each date (10-minute intervals)
- Pickup time windows and latest dropoff times
- Booking window rules (max/min days advance, same-day allowed)

Use this BEFORE booking to show user available times.

IMPORTANT: If pickup and dropoff addresses are provided, returns exact time slots for that route.
If addresses are omitted, returns only available dates and booking window rules.

DATE FORMATS ACCEPTED:
- YYYY-MM-DD (e.g., "2026-01-15")
- Day names: "monday", "tuesday", etc.
- Relative: "today", "tomorrow"

TIME FORMAT:
All times returned in 12-hour format (e.g., "6:30 AM", "3:45 PM").

REMOTE MODE: Include session_id from connect_account/complete_connection.

${PLAIN_LANGUAGE_GUIDELINES}`,
        {
          session_id: z
            .string()
            .uuid()
            .optional()
            .describe('Session ID (required for remote mode, optional for local)'),
          pickup_address: z
            .string()
            .optional()
            .describe('Full pickup address. Required to get exact time slots.'),
          dropoff_address: z
            .string()
            .optional()
            .describe('Full dropoff address. Required to get exact time slots.'),
          date: z
            .string()
            .optional()
            .describe('Check this specific date (YYYY-MM-DD, day name, or relative). If omitted with addresses, checks all available dates.'),
          timezone: z
            .string()
            .optional()
            .describe('Timezone for date calculations (e.g., "America/Edmonton"). Defaults to America/Edmonton.'),
        },
        async ({ session_id, pickup_address, dropoff_address, date, timezone = 'America/Edmonton' }) => {
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

            // Always get available dates and booking window
            const daysWindow = await api.getBookingDaysWindow('pickup');

            // Format available dates for display
            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const availableDates = daysWindow.availableDates.map(d => ({
              date: d.date,
              dayOfWeek: dayNames[d.dayOfWeek - 1] || 'Unknown',
              formatted: d.date.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'),
            }));

            // Build basic response
            const result: any = {
              success: true,
              bookingWindow: {
                maxDaysAdvance: daysWindow.maxDaysAdvance,
                minDaysAdvance: daysWindow.minDaysAdvance,
                sameDayAllowed: daysWindow.sameDayAllowed,
              },
              availableDates,
            };

            // If addresses provided, get time slots
            if (pickup_address && dropoff_address) {
              // Geocode addresses
              logger.debug(`Geocoding pickup address: ${pickup_address}`);
              const pickupCoords = await geocodeAddress(pickup_address);

              logger.debug(`Geocoding dropoff address: ${dropoff_address}`);
              const dropoffCoords = await geocodeAddress(dropoff_address);

              if (!pickupCoords || !dropoffCoords) {
                return createErrorResponse({
                  category: ErrorCategory.VALIDATION_ERROR,
                  message:
                    'Could not geocode one or both addresses. Please provide complete addresses (street number, street name, city).',
                  recoverable: true,
                });
              }

              // Convert to microdegrees for DATS API
              const pickupLat = Math.round(pickupCoords.lat * 1000000);
              const pickupLon = Math.round(pickupCoords.lon * 1000000);
              const dropoffLat = Math.round(dropoffCoords.lat * 1000000);
              const dropoffLon = Math.round(dropoffCoords.lon * 1000000);

              // Determine which date(s) to check
              const datesToCheck = date
                ? [parseFlexibleDate(date, timezone).replace(/-/g, '')]
                : availableDates.map(d => d.date);

              logger.debug(`Checking time slots for ${datesToCheck.length} date(s)`);

              // Get time slots for each date
              const timeSlotsPerDate = [];

              for (const checkDate of datesToCheck) {
                try {
                  const timesWindow = await api.getBookingTimesWindow(
                    checkDate,
                    pickupLat,
                    pickupLon,
                    dropoffLat,
                    dropoffLon,
                    'pickup'
                  );

                  const formattedSlots = timesWindow.timeSlots.map(slot => ({
                    pickupTime: secondsToTime(slot.time),
                    latestDropoff: secondsToTime(slot.lastBookingTime),
                    durationMinutes: Math.round((slot.lastBookingTime - slot.time) / 60),
                    index: slot.index,
                  }));

                  timeSlotsPerDate.push({
                    date: checkDate.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'),
                    dayOfWeek: availableDates.find(d => d.date === checkDate)?.dayOfWeek || 'Unknown',
                    timeInterval: `${timesWindow.timeInterval / 60} minutes`,
                    totalSlots: formattedSlots.length,
                    timeSlots: formattedSlots,
                    firstBookingTime: secondsToTime(timesWindow.firstBookingTime),
                    lastBookingTime: secondsToTime(timesWindow.lastBookingTime),
                  });
                } catch (error) {
                  logger.warn(`Could not get time slots for ${checkDate}: ${error instanceof Error ? error.message : String(error)}`);
                }
              }

              result.route = {
                pickup: pickup_address,
                dropoff: dropoff_address,
              };
              result.timeSlotsPerDate = timeSlotsPerDate;

              // Create user-friendly message
              if (timeSlotsPerDate.length > 0) {
                const slotsSummary = timeSlotsPerDate
                  .map(
                    d =>
                      `- ${d.dayOfWeek}, ${d.date}: ${d.totalSlots} time slots available (${d.firstBookingTime} - ${d.lastBookingTime})`
                  )
                  .join('\n');

                result.userMessage =
                  `Found time slots for your route:\n` +
                  `From: ${pickup_address}\n` +
                  `To: ${dropoff_address}\n\n` +
                  slotsSummary +
                  `\n\nEach slot is ${timeSlotsPerDate[0]?.timeInterval} apart. All times shown are pickup times in Edmonton timezone (MST/MDT).`;
              } else {
                result.userMessage = `No time slots available for the requested route and date(s).`;
              }
            } else {
              // No addresses provided - just show available dates
              const datesList = availableDates.map(d => `- ${d.dayOfWeek}, ${d.formatted}`).join('\n');

              result.userMessage =
                `DATS Booking Window:\n` +
                `- Book up to ${daysWindow.maxDaysAdvance} days in advance\n` +
                `- Same-day booking: ${daysWindow.sameDayAllowed ? 'Allowed' : 'Not allowed'}\n\n` +
                `Available dates:\n${datesList}\n\n` +
                `To see exact time slots, provide pickup and dropoff addresses.`;
            }

            // Add date context
            const dateInfo = getCurrentDateInfo(timezone);
            result.dateContext = {
              currentDate: dateInfo.today,
              currentDayOfWeek: dateInfo.dayOfWeek,
              timezone,
              note: 'All DATS times are in Edmonton timezone (MST/MDT)',
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
