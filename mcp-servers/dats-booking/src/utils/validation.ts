/**
 * Validation utilities for DATS business rules
 *
 * Rules from PRD.md Appendix A:
 * - 3-day advance booking maximum
 * - Noon cutoff for next-day bookings
 * - 2-hour minimum notice for same-day
 * - 2-hour cancellation notice
 */

import type { BookTripInput } from '../types.js';

/**
 * Validate booking request against DATS business rules
 * @returns Error message if invalid, null if valid
 */
export function validateBookingRequest(input: BookTripInput): string | null {
  const now = new Date();
  const bookingDate = parseDate(input.pickupDate);

  if (!bookingDate) {
    return 'Invalid date format. Use YYYY-MM-DD.';
  }

  const bookingDateTime = combineDateAndTime(bookingDate, input.pickupTime);
  if (!bookingDateTime) {
    return 'Invalid time format. Use HH:MM (24-hour).';
  }

  if (bookingDateTime <= now) {
    return 'Cannot book trips in the past.';
  }

  const maxAdvance = new Date(now);
  maxAdvance.setDate(maxAdvance.getDate() + 3);
  maxAdvance.setHours(23, 59, 59, 999);

  if (bookingDateTime > maxAdvance) {
    return 'DATS allows booking only up to 3 days in advance.';
  }

  if (isSameDay(now, bookingDate)) {
    const hoursUntilPickup =
      (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (hoursUntilPickup < 2) {
      return 'Same-day bookings require at least 2 hours notice.';
    }
  }

  if (isNextDay(now, bookingDate)) {
    const currentHour = now.getHours();
    if (currentHour >= 12) {
      return 'Next-day bookings must be made before noon.';
    }
  }

  return null;
}

/**
 * Validate cancellation against 2-hour rule
 */
export function validateCancellation(pickupDateTime: Date): string | null {
  const now = new Date();
  const hoursUntilPickup =
    (pickupDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursUntilPickup < 2) {
    return 'Cancellations require at least 2 hours notice before pickup.';
  }

  return null;
}

function parseDate(dateStr: string): Date | null {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const [, year, month, day] = match;
  const date = new Date(
    parseInt(year, 10),
    parseInt(month, 10) - 1,
    parseInt(day, 10)
  );

  if (
    date.getFullYear() !== parseInt(year, 10) ||
    date.getMonth() !== parseInt(month, 10) - 1 ||
    date.getDate() !== parseInt(day, 10)
  ) {
    return null;
  }

  return date;
}

function combineDateAndTime(date: Date, timeStr: string): Date | null {
  const match = timeStr.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;

  const [, hours, minutes] = match;
  const combined = new Date(date);
  combined.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);

  return combined;
}

function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

function isNextDay(today: Date, bookingDate: Date): boolean {
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return isSameDay(tomorrow, bookingDate);
}
