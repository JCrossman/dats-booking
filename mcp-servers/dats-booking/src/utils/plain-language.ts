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
 * Groups by date, uses plain language, screen-reader friendly
 */
export function formatTripsForUser(trips: Trip[]): string {
  if (trips.length === 0) {
    return 'You have no upcoming trips.';
  }

  const lines: string[] = [];
  lines.push(`You have ${trips.length} upcoming ${trips.length === 1 ? 'trip' : 'trips'}:`);
  lines.push('');

  // Group trips by date
  const tripsByDate = groupTripsByDate(trips);

  for (const [date, dateTrips] of Object.entries(tripsByDate)) {
    lines.push(date);

    for (const trip of dateTrips) {
      lines.push(formatSingleTrip(trip));
    }

    lines.push('');
  }

  return lines.join('\n').trim();
}

/**
 * Format a single trip in plain language
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
export const PLAIN_LANGUAGE_GUIDELINES = `
RESPONSE FORMATTING (Grade 6 reading level):
- Use short sentences (under 20 words)
- Use common, everyday words
- Say "ride" not "transportation", "helper" not "attendant"
- Use active voice: "Your ride will come" not "A vehicle will be dispatched"
- Be specific: "between 2:00 and 2:30 PM" not "within the pickup window"
- For dates, include the day of week: "Sunday, January 12"
- Use "to" between locations, not arrows
- Put confirmation numbers at the end in brackets: [#12345678]

EXAMPLE GOOD RESPONSE:
"Your trip is booked!
Your ride will come between 2:00 and 2:30 PM on Sunday, January 12.
You're going from Home to City Hall, with your wheelchair.
Your confirmation number is 12345678. Save this in case you need to cancel."

EXAMPLE BAD RESPONSE:
"Booking confirmed. Confirmation #12345678. Pickup window: 14:00-14:30.
Origin: 123 Main Street NW, Edmonton, AB T5K 0A1
Destination: 1 Sir Winston Churchill Square, Edmonton, AB T5J 2R7
Space type: WC. Status: Scheduled."
`.trim();
