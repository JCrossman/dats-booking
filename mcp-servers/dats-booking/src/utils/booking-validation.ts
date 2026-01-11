/**
 * Booking Window Validation
 *
 * DATS Business Rules:
 * - Advance booking: Up to 3 days ahead, cutoff at noon day before
 * - Same-day booking: 2-hour minimum notice, not guaranteed
 * - Cancellation: 2-hour minimum notice required
 * - Pickup window: 30 minutes (vehicle waits 5 minutes max)
 */

export interface BookingValidationResult {
  valid: boolean;
  warning?: string;
  error?: string;
}

export interface CancellationValidationResult {
  valid: boolean;
  warning?: string;
  error?: string;
  minutesUntilTrip?: number;
}

/**
 * Validate a booking request against DATS business rules
 *
 * @param pickupDate - Date in YYYY-MM-DD format
 * @param pickupTime - Time in HH:MM 24-hour format
 * @param now - Current date/time (optional, for testing)
 */
export function validateBookingWindow(
  pickupDate: string,
  pickupTime: string,
  now: Date = new Date()
): BookingValidationResult {
  const pickup = parsePickupDateTime(pickupDate, pickupTime);

  if (!pickup) {
    return {
      valid: false,
      error: 'Could not parse the date or time. Please use YYYY-MM-DD for date and HH:MM for time.',
    };
  }

  // Check if pickup is in the past
  if (pickup <= now) {
    return {
      valid: false,
      error: 'The pickup time has already passed. Please choose a future time.',
    };
  }

  const minutesUntilPickup = (pickup.getTime() - now.getTime()) / (1000 * 60);
  const hoursUntilPickup = minutesUntilPickup / 60;
  const daysUntilPickup = hoursUntilPickup / 24;

  // Check if too far in advance (more than 3 days)
  if (daysUntilPickup > 3) {
    return {
      valid: false,
      error: `DATS only allows booking up to 3 days in advance. Your requested date is ${Math.floor(daysUntilPickup)} days away.`,
    };
  }

  // Check same-day vs advance booking rules
  const isSameDay = isSameDayBooking(now, pickup);

  if (isSameDay) {
    // Same-day: 2-hour minimum notice required
    if (hoursUntilPickup < 2) {
      return {
        valid: false,
        error: `Same-day bookings need at least 2 hours notice. Your pickup is only ${Math.floor(minutesUntilPickup)} minutes away.`,
      };
    }

    // Same-day booking is allowed but warn it's not guaranteed
    return {
      valid: true,
      warning:
        'Same-day bookings are not guaranteed. DATS will try to fit you in, but service depends on availability.',
    };
  }

  // Advance booking: check noon cutoff rule
  // Bookings for tomorrow (or later) must be made before noon the day before
  const noonCutoff = getNoonCutoffForDate(pickup);

  if (now >= noonCutoff) {
    // We're past the noon cutoff for this date
    const dayName = pickup.toLocaleDateString('en-US', { weekday: 'long' });

    // If it's for tomorrow and we're past noon today, it becomes same-day rules
    if (daysUntilPickup < 1.5) {
      // Check 2-hour rule for what is effectively same-day
      if (hoursUntilPickup < 2) {
        return {
          valid: false,
          error: `The noon cutoff has passed for booking ${dayName}. Same-day rules apply, and you need at least 2 hours notice.`,
        };
      }
      return {
        valid: true,
        warning: `The noon cutoff has passed. This will be treated as a same-day booking and is not guaranteed.`,
      };
    }
  }

  // Valid advance booking
  return { valid: true };
}

/**
 * Validate a cancellation request against DATS 2-hour notice rule
 *
 * @param tripDate - Date string (various formats supported)
 * @param pickupWindowStart - Start of pickup window (e.g., "7:50 AM")
 * @param now - Current date/time (optional, for testing)
 */
export function validateCancellation(
  tripDate: string,
  pickupWindowStart: string,
  now: Date = new Date()
): CancellationValidationResult {
  const tripDateTime = parseTripDateTime(tripDate, pickupWindowStart);

  if (!tripDateTime) {
    // If we can't parse the time, allow cancellation but warn
    return {
      valid: true,
      warning: 'Could not verify the 2-hour notice requirement. Please ensure you have enough notice.',
    };
  }

  const minutesUntilTrip = (tripDateTime.getTime() - now.getTime()) / (1000 * 60);

  if (minutesUntilTrip < 0) {
    return {
      valid: false,
      error: 'This trip has already started or passed. It cannot be cancelled.',
      minutesUntilTrip: Math.floor(minutesUntilTrip),
    };
  }

  if (minutesUntilTrip < 120) {
    // Less than 2 hours notice
    return {
      valid: false,
      error: `DATS requires 2 hours notice to cancel. Your trip starts in ${Math.floor(minutesUntilTrip)} minutes. Please call DATS directly at 780-986-6010 for late cancellations.`,
      minutesUntilTrip: Math.floor(minutesUntilTrip),
    };
  }

  if (minutesUntilTrip < 180) {
    // Between 2-3 hours - valid but warn
    return {
      valid: true,
      warning: `Your trip is in ${Math.floor(minutesUntilTrip / 60)} hours. Cancellation is allowed, but please cancel early when possible.`,
      minutesUntilTrip: Math.floor(minutesUntilTrip),
    };
  }

  return {
    valid: true,
    minutesUntilTrip: Math.floor(minutesUntilTrip),
  };
}

/**
 * Parse pickup date and time into a Date object
 */
function parsePickupDateTime(date: string, time: string): Date | null {
  try {
    // Date format: YYYY-MM-DD
    const [year, month, day] = date.split('-').map(Number);

    // Time format: HH:MM (24-hour)
    const [hours, minutes] = time.split(':').map(Number);

    if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hours) || isNaN(minutes)) {
      return null;
    }

    const result = new Date(year, month - 1, day, hours, minutes);

    // Validate the date is real (e.g., not Feb 30)
    if (
      result.getFullYear() !== year ||
      result.getMonth() !== month - 1 ||
      result.getDate() !== day
    ) {
      return null;
    }

    return result;
  } catch {
    return null;
  }
}

/**
 * Parse trip date and pickup window start time
 * Handles various date formats from DATS API
 */
function parseTripDateTime(dateStr: string, timeStr: string): Date | null {
  try {
    let year: number, month: number, day: number;

    // Handle various date formats
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // YYYY-MM-DD
      [year, month, day] = dateStr.split('-').map(Number);
    } else if (dateStr.match(/^\d{8}$/)) {
      // YYYYMMDD
      year = parseInt(dateStr.substring(0, 4), 10);
      month = parseInt(dateStr.substring(4, 6), 10);
      day = parseInt(dateStr.substring(6, 8), 10);
    } else if (dateStr.includes(',')) {
      // "Sunday, January 12" or "Jan 12, 2026"
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) {
        year = parsed.getFullYear();
        month = parsed.getMonth() + 1;
        day = parsed.getDate();
      } else {
        return null;
      }
    } else {
      // Try native parsing as fallback
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) {
        year = parsed.getFullYear();
        month = parsed.getMonth() + 1;
        day = parsed.getDate();
      } else {
        return null;
      }
    }

    // Parse time like "7:50 AM" or "14:30"
    let hours: number, minutes: number;

    const time12Match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    const time24Match = timeStr.match(/(\d{1,2}):(\d{2})$/);

    if (time12Match) {
      hours = parseInt(time12Match[1], 10);
      minutes = parseInt(time12Match[2], 10);
      const period = time12Match[3].toUpperCase();

      if (period === 'PM' && hours !== 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;
    } else if (time24Match) {
      hours = parseInt(time24Match[1], 10);
      minutes = parseInt(time24Match[2], 10);
    } else {
      return null;
    }

    return new Date(year, month - 1, day, hours, minutes);
  } catch {
    return null;
  }
}

/**
 * Check if the booking is for the same calendar day
 */
function isSameDayBooking(now: Date, pickup: Date): boolean {
  return (
    now.getFullYear() === pickup.getFullYear() &&
    now.getMonth() === pickup.getMonth() &&
    now.getDate() === pickup.getDate()
  );
}

/**
 * Get the noon cutoff time for booking a specific date
 * Returns noon of the day before the pickup date
 */
function getNoonCutoffForDate(pickupDate: Date): Date {
  const cutoff = new Date(pickupDate);
  cutoff.setDate(cutoff.getDate() - 1);
  cutoff.setHours(12, 0, 0, 0);
  return cutoff;
}

/**
 * Format a time duration in a human-friendly way
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} minutes`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return hours === 1 ? '1 hour' : `${hours} hours`;
  }
  return `${hours} hour${hours > 1 ? 's' : ''} and ${remainingMinutes} minutes`;
}
