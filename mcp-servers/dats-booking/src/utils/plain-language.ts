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

import type { Trip, BookTripOutput, PickupWindow } from '../types.js';

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
 * Returns a simple summary - Claude will format the table from structured data
 */
export function formatTripsForUser(trips: Trip[]): string {
  if (trips.length === 0) {
    return 'You have no upcoming trips.';
  }

  return `You have ${trips.length} ${trips.length === 1 ? 'trip' : 'trips'}. Display them in a table with columns: Date, Time, From, To, Status, Confirmation.`;
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
      date = new Date(Date.UTC(year, month, day));
    } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // YYYY-MM-DD
      const [year, month, day] = dateStr.split('-').map(Number);
      date = new Date(Date.UTC(year, month - 1, day));
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
IMPORTANT - HOW TO DISPLAY TRIPS:
When displaying trips, YOU MUST format them as a markdown table using the "trips" array data.
Use these columns: Date, Time, From, To, Status, Confirmation

Example output format:
| Date | Time | From | To | Status | Confirmation |
|------|------|------|-----|--------|--------------|
| Tue, Jan 13, 2026 | 2:30 PM-3:00 PM | McNally High School | 9713 160 St NW | Scheduled | 18789349 |

For dates: Use the date field exactly as provided (it includes day of week). Do NOT modify or recalculate dates.
For addresses: Use title case (not ALL CAPS). Show the full address from pickupAddress/destinationAddress fields.
For status: Use the statusLabel field (e.g., "Scheduled", "Performed", "Cancelled").
`.trim();
