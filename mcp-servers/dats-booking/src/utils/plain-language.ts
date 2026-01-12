/**
 * Plain Language Response Formatter
 *
 * Transforms API responses into user-friendly messages at Grade 6 reading level.
 * Target: Short sentences (under 20 words), simple words, active voice.
 *
 * Grade 6 Guidelines:
 * - Use common, everyday words
 * - Keep sentences short (under 20 words)
 * - Use active voice ("We booked your trip" not "Your trip was booked")
 * - Be specific and concrete
 * - Avoid jargon and technical terms
 */

import type { Trip, BookTripOutput, PickupWindow, TripStatusCode } from '../types.js';
import { TRIP_STATUSES } from '../types.js';

/**
 * Format a booking confirmation for the user
 */
export function formatBookingConfirmation(result: BookTripOutput): string {
  if (!result.success) {
    return 'We could not book your trip. Please try again.';
  }

  const lines: string[] = [];

  lines.push('Your trip is booked!');

  if (result.pickupWindow) {
    lines.push(`Your ride will come between ${formatTimeWindow(result.pickupWindow)}.`);
  }

  if (result.confirmationNumber) {
    lines.push(`Your confirmation number is ${result.confirmationNumber}.`);
    lines.push('Save this number in case you need to cancel.');
  }

  return lines.join('\n');
}

/**
 * Format a cancellation confirmation for the user
 */
export function formatCancellationConfirmation(success: boolean, message?: string): string {
  if (success) {
    return 'Your trip has been cancelled. You do not need to do anything else.';
  }
  return message || 'We could not cancel your trip. Please call DATS at 780-986-6010.';
}

/**
 * Format a list of trips for the user
 * Groups by date, uses plain language, screen-reader friendly
 *
 * Accessibility requirements:
 * - One trip per visual block with blank lines between
 * - Minimal, scannable format
 * - Uses markdown for Claude Desktop rendering
 * - Double newlines to ensure line breaks are preserved
 */
export function formatTripsForUser(trips: Trip[]): string {
  if (trips.length === 0) {
    return 'You have no upcoming trips.';
  }

  const sections: string[] = [];
  sections.push(`You have ${trips.length} upcoming ${trips.length === 1 ? 'trip' : 'trips'}:`);

  // Group trips by date
  const tripsByDate = groupTripsByDate(trips);

  for (const [date, dateTrips] of Object.entries(tripsByDate)) {
    // Date header + all trips for that date
    const dateSection: string[] = [];
    dateSection.push(`**${date.toUpperCase()}**`);

    dateTrips.forEach((trip) => {
      dateSection.push(formatTripCompact(trip));
    });

    sections.push(dateSection.join('\n\n'));
  }

  // Join sections with double newlines for clear visual separation
  return sections.join('\n\n');
}

/**
 * Format trip status for display (only show non-normal statuses)
 * Returns null for Scheduled trips since that's the expected state
 */
function formatTripStatus(status: TripStatusCode): string | null {
  // Don't show status for normal scheduled trips
  if (status === 'S') return null;

  const statusInfo = TRIP_STATUSES[status];
  return statusInfo ? statusInfo.label : null;
}

/**
 * Format a trip in a compact, scannable format
 * One trip = one short block that's easy to scan
 * Uses explicit "From:" and "To:" labels for screen reader compatibility
 */
function formatTripCompact(trip: Trip): string {
  const timeLabel = getTimeOfDayLabel(trip.pickupWindow.start);
  const timeWindow = `${trip.pickupWindow.start} to ${trip.pickupWindow.end}`;
  const from = toTitleCase(simplifyAddress(trip.pickupAddress));
  const to = toTitleCase(simplifyAddress(trip.destinationAddress));
  const confNum = trip.confirmationNumber || trip.bookingId;

  // Add status indicator for non-scheduled trips
  const statusText = formatTripStatus(trip.status as TripStatusCode);
  const statusLine = statusText ? `\nStatus: ${statusText}` : '';

  // Format with explicit labels (screen reader friendly):
  // Morning trip: 7:50 AM to 8:20 AM
  // From: 9713 160 Street NW
  // To: McNally High School
  // Confirmation: 18789348
  // Status: Arrived (only shown for non-scheduled trips)
  return `${timeLabel}: ${timeWindow}
From: ${from}
To: ${to}
Confirmation: ${confNum}${statusLine}`;
}

/**
 * Format a single trip in plain language (legacy format, kept for compatibility)
 */
export function formatSingleTrip(trip: Trip): string {
  const parts: string[] = [];

  // Time window
  if (trip.pickupWindow.start && trip.pickupWindow.end) {
    parts.push(`${trip.pickupWindow.start} to ${trip.pickupWindow.end}`);
  }

  // Addresses - simplify to just the key parts
  const pickup = simplifyAddress(trip.pickupAddress);
  const dest = simplifyAddress(trip.destinationAddress);
  parts.push(`${pickup} to ${dest}`);

  // Mobility device
  if (trip.mobilityDevice && trip.mobilityDevice !== 'Ambulatory') {
    parts.push(`with ${trip.mobilityDevice.toLowerCase()}`);
  }

  // Passengers
  if (trip.additionalPassengers && trip.additionalPassengers.length > 0) {
    const passengerText = trip.additionalPassengers
      .map((p) => `${p.count} ${formatPassengerType(p.type)}`)
      .join(', ');
    parts.push(`with ${passengerText}`);
  }

  // Confirmation number at end
  const confNum = trip.confirmationNumber || trip.bookingId;
  parts.push(`[#${confNum}]`);

  return `  ${parts.join(', ')}`;
}

/**
 * Format a single trip with accessible structure
 * Each piece of information on its own labeled line
 */
export function formatSingleTripAccessible(trip: Trip): string[] {
  const lines: string[] = [];

  // Pickup time - most important, what user needs to act on
  if (trip.pickupWindow.start && trip.pickupWindow.end) {
    lines.push(`  Pickup time: ${trip.pickupWindow.start} to ${trip.pickupWindow.end}`);
  }

  // From address - title case, simplified
  const pickup = toTitleCase(simplifyAddress(trip.pickupAddress));
  lines.push(`  From: ${pickup}`);

  // To address - title case, simplified
  const dest = toTitleCase(simplifyAddress(trip.destinationAddress));
  lines.push(`  To: ${dest}`);

  // Mobility device (only if not ambulatory)
  if (trip.mobilityDevice && trip.mobilityDevice !== 'Ambulatory') {
    const device = formatMobilityDevice(trip.mobilityDevice);
    if (device) {
      lines.push(`  With: ${device}`);
    }
  }

  // Additional passengers
  if (trip.additionalPassengers && trip.additionalPassengers.length > 0) {
    const passengerText = trip.additionalPassengers
      .map((p) => `${p.count} ${formatPassengerType(p.type)}`)
      .join(', ');
    lines.push(`  Passengers: ${passengerText}`);
  }

  // Confirmation number - reference info, last
  const confNum = trip.confirmationNumber || trip.bookingId;
  lines.push(`  Confirmation: ${confNum}`);

  return lines;
}

/**
 * Get a time-of-day label based on the pickup time
 */
function getTimeOfDayLabel(time: string | undefined): string {
  if (!time) return 'Trip';

  // Parse hour from time string like "7:50 AM" or "2:30 PM"
  const match = time.match(/(\d{1,2}):?\d*\s*(AM|PM)/i);
  if (!match) return 'Trip';

  let hour = parseInt(match[1], 10);
  const period = match[2].toUpperCase();

  // Convert to 24-hour for easier comparison
  if (period === 'PM' && hour !== 12) hour += 12;
  if (period === 'AM' && hour === 12) hour = 0;

  if (hour < 12) return 'Morning trip';
  if (hour < 17) return 'Afternoon trip';
  return 'Evening trip';
}

/**
 * Convert string to title case
 */
function toTitleCase(str: string): string {
  if (!str) return str;

  // Handle ALL CAPS input
  const lower = str.toLowerCase();

  // Capitalize first letter of each word, but keep certain words lowercase
  const smallWords = ['to', 'the', 'and', 'of', 'in', 'at', 'for', 'on', 'nw', 'ne', 'sw', 'se'];

  return lower
    .split(' ')
    .map((word, index) => {
      // Always capitalize first word
      if (index === 0) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      }
      // Keep direction abbreviations uppercase
      if (['nw', 'ne', 'sw', 'se'].includes(word)) {
        return word.toUpperCase();
      }
      // Keep small words lowercase unless they start the string
      if (smallWords.includes(word)) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

/**
 * Format a time window in plain language
 */
export function formatTimeWindow(window: PickupWindow): string {
  if (!window.start || !window.end) {
    return 'the scheduled time';
  }

  // If same period (AM/PM), only show it once at end
  const startPeriod = window.start.includes('AM') ? 'AM' : 'PM';
  const endPeriod = window.end.includes('AM') ? 'AM' : 'PM';

  if (startPeriod === endPeriod) {
    const startTime = window.start.replace(` ${startPeriod}`, '');
    return `${startTime} and ${window.end}`;
  }

  return `${window.start} and ${window.end}`;
}

/**
 * Simplify an address to its most important parts
 */
export function simplifyAddress(address: string): string {
  if (!address || address === 'Unknown address') {
    return 'your location';
  }

  // If it has a name (like "Home" or "Work"), use that
  const parts = address.split(',').map((p) => p.trim());

  // Check if first part is a named location (not a street number)
  const firstPart = parts[0];
  if (firstPart && !/^\d/.test(firstPart)) {
    // It's a name like "Home" or "City Hall"
    return firstPart;
  }

  // Otherwise, return street address (first two parts usually)
  if (parts.length >= 2) {
    return `${parts[0]}, ${parts[1]}`;
  }

  return parts[0] || 'your location';
}

/**
 * Format passenger type in plain language
 */
export function formatPassengerType(type: 'escort' | 'pca' | 'guest'): string {
  switch (type) {
    case 'escort':
      return 'companion';
    case 'pca':
      return 'care helper';
    case 'guest':
      return 'guest';
    default:
      return type;
  }
}

/**
 * Format mobility device in plain language
 */
export function formatMobilityDevice(device: string | undefined): string {
  if (!device) return '';

  const mapping: Record<string, string> = {
    wheelchair: 'wheelchair',
    Wheelchair: 'wheelchair',
    WC: 'wheelchair',
    scooter: 'scooter',
    Scooter: 'scooter',
    SC: 'scooter',
    walker: 'walker',
    Walker: 'walker',
    WA: 'walker',
    ambulatory: '', // Don't mention if ambulatory
    Ambulatory: '',
    AM: '',
  };

  return mapping[device] || device.toLowerCase();
}

/**
 * Format a date in plain language with day of week
 */
export function formatDatePlain(dateStr: string): string {
  try {
    // Handle various formats
    let date: Date;

    if (dateStr.match(/^\d{8}$/)) {
      // YYYYMMDD
      const year = parseInt(dateStr.substring(0, 4), 10);
      const month = parseInt(dateStr.substring(4, 6), 10) - 1;
      const day = parseInt(dateStr.substring(6, 8), 10);
      date = new Date(year, month, day);
    } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // YYYY-MM-DD
      const [year, month, day] = dateStr.split('-').map(Number);
      date = new Date(year, month - 1, day);
    } else {
      // Try native parsing
      date = new Date(dateStr);
    }

    if (isNaN(date.getTime())) {
      return dateStr;
    }

    // Format: "Sunday, January 12"
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Group trips by their formatted date
 */
function groupTripsByDate(trips: Trip[]): Record<string, Trip[]> {
  const grouped: Record<string, Trip[]> = {};

  for (const trip of trips) {
    const dateKey = formatDatePlain(trip.date);
    if (!grouped[dateKey]) {
      grouped[dateKey] = [];
    }
    grouped[dateKey].push(trip);
  }

  return grouped;
}

/**
 * Plain language guidelines for AI clients
 * Include this in tool descriptions to guide response formatting
 */
/**
 * Format availability information for the user
 */
export function formatAvailabilityForUser(
  availableDates: string[],
  timeWindow?: { earliest: string; latest: string },
  requestedDate?: string
): string {
  const lines: string[] = [];

  if (availableDates.length === 0) {
    return 'There are no dates available for booking right now. Please try again later.';
  }

  if (requestedDate && timeWindow) {
    // User asked about a specific date
    const formattedDate = formatDatePlain(requestedDate);
    lines.push(`On ${formattedDate}, you can book a pickup between ${timeWindow.earliest} and ${timeWindow.latest}.`);
    lines.push('');
    lines.push('Other available dates:');
  } else {
    lines.push('You can book trips on these dates:');
  }

  // Format each available date
  for (const date of availableDates) {
    const formatted = formatDatePlain(date);
    lines.push(`  - ${formatted}`);
  }

  lines.push('');
  lines.push('To check times for a specific date, ask about that date.');

  return lines.join('\n');
}

export const PLAIN_LANGUAGE_GUIDELINES = `
RESPONSE FORMATTING (Grade 6 reading level):
- Use short sentences (under 20 words)
- Use common, everyday words
- Say "ride" not "transportation", "helper" not "attendant"
- Use active voice: "Your ride will come" not "A vehicle will be dispatched"
- Be specific: "between 2:00 and 2:30 PM" not "within the pickup window"
- For dates, include the day of week: "SUNDAY, JANUARY 12"

TRIP DISPLAY FORMAT:
- Display each trip as its own block with blank lines between
- Use time-of-day labels: "Morning trip:", "Afternoon trip:", "Evening trip:"
- Use labeled fields on separate lines:
  - Pickup time: 7:50 AM to 8:20 AM
  - From: [pickup address]
  - To: [destination]
  - Confirmation: [number]
- Use title case for addresses (not ALL CAPS)
- Never put multiple trips on the same line

EXAMPLE GOOD TRIP DISPLAY:
"You have 2 upcoming trips:

MONDAY, JANUARY 12

Morning trip:
  Pickup time: 7:50 AM to 8:20 AM
  From: 9713 160 Street NW
  To: McNally High School
  Confirmation: 18789348

Afternoon trip:
  Pickup time: 2:30 PM to 3:00 PM
  From: McNally High School
  To: 9713 160 Street NW
  Confirmation: 18789349"

EXAMPLE BAD TRIP DISPLAY:
"Monday, January 12 7:50 AM to 8:20 AM, 9713 160 STREET NW to MCNALLY SENIOR HIGH SCHOOL [#18789348] 2:30 PM to 3:00 PM, MCNALLY SENIOR HIGH SCHOOL to 9713 160 STREET NW [#18789349]"
`.trim();
