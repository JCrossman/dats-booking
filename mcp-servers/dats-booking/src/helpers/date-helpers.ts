/**
 * Date Helper Functions
 *
 * Utilities for parsing and formatting dates in the DATS booking system.
 * Handles flexible date inputs (relative dates, day names) and various
 * DATS API date formats.
 *
 * All dates are handled in UTC to avoid timezone issues.
 * Timezone conversions happen at the boundary (user input/output).
 */

import { DAY_NAMES, MONTH_NAMES, API_CONSTANTS, PADDING } from '../constants.js';

/**
 * Parse a date string that can be either YYYY-MM-DD or a relative date like "Thursday"
 * Uses the specified timezone for calculations (defaults to America/Edmonton for DATS users)
 *
 * @param dateStr - Date string (YYYY-MM-DD, "today", "tomorrow", "thursday", "next monday")
 * @param timezone - IANA timezone string (e.g., "America/Edmonton")
 * @returns ISO date string in YYYY-MM-DD format
 */
export function parseFlexibleDate(dateStr: string, timezone: string = API_CONSTANTS.DEFAULT_TIMEZONE): string {
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

  // Create a UTC date object representing "today" (timezone-neutral)
  const today = new Date(Date.UTC(year, month - 1, day));
  const currentDayOfWeek = today.getUTCDay(); // 0 = Sunday, 6 = Saturday

  const input = dateStr.toLowerCase().trim();

  // Handle relative date keywords
  if (input === 'today') {
    return formatDateYMD(today);
  }
  if (input === 'tomorrow') {
    today.setUTCDate(today.getUTCDate() + 1);
    return formatDateYMD(today);
  }
  if (input === 'yesterday') {
    today.setUTCDate(today.getUTCDate() - 1);
    return formatDateYMD(today);
  }

  // Handle day names (find next occurrence)
  const dayIndex = (DAY_NAMES as readonly string[]).indexOf(input);
  if (dayIndex !== -1) {
    // Calculate days until the target day
    let daysUntil = dayIndex - currentDayOfWeek;
    if (daysUntil <= 0) {
      daysUntil += 7; // Move to next week if today or past
    }
    today.setUTCDate(today.getUTCDate() + daysUntil);
    return formatDateYMD(today);
  }

  // Handle "next <day>"
  const nextDayMatch = input.match(/^next\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/);
  if (nextDayMatch) {
    const targetDay = (DAY_NAMES as readonly string[]).indexOf(nextDayMatch[1]);
    let daysUntil = targetDay - currentDayOfWeek;
    if (daysUntil <= 0) {
      daysUntil += 7;
    }
    today.setUTCDate(today.getUTCDate() + daysUntil);
    return formatDateYMD(today);
  }

  // If we can't parse it, return as-is (will fail validation if invalid)
  return dateStr;
}

/**
 * Format a Date object as YYYY-MM-DD
 *
 * @param date - Date object to format
 * @returns ISO date string (YYYY-MM-DD)
 */
export function formatDateYMD(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(PADDING.DATE_COMPONENT, PADDING.PAD_CHAR);
  const d = String(date.getUTCDate()).padStart(PADDING.DATE_COMPONENT, PADDING.PAD_CHAR);
  return `${y}-${m}-${d}`;
}

/**
 * Normalize a trip date string to YYYY-MM-DD format for comparison
 * Handles formats like "Tue, Jan 13, 2026" from the DATS API
 *
 * @param dateStr - Date string from DATS API (various formats)
 * @returns ISO date string (YYYY-MM-DD) or empty string if unparseable
 */
export function normalizeTripDate(dateStr: string): string {
  // If already in YYYY-MM-DD format, return as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }

  // Try to parse "Day, Mon DD, YYYY" format
  const match = dateStr.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (match) {
    const monthStr = match[1].toLowerCase().substring(0, 3);
    const month = MONTH_NAMES[monthStr];
    const day = match[2].padStart(PADDING.DATE_COMPONENT, PADDING.PAD_CHAR);
    const year = match[3];

    if (month) {
      return `${year}-${month}-${day}`;
    }
  }

  // Fallback: return empty string (won't match any date)
  return '';
}

/**
 * Get current date info for the response (helps Claude understand context)
 *
 * @param timezone - IANA timezone string (e.g., "America/Edmonton")
 * @returns Object with today's date and day of week
 */
export function getCurrentDateInfo(timezone: string = API_CONSTANTS.DEFAULT_TIMEZONE): { today: string; dayOfWeek: string } {
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
