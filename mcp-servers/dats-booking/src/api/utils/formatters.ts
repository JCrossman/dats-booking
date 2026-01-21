/**
 * Date and Time Formatting Utilities
 *
 * Utilities for converting between different date/time formats used by the DATS API.
 */

/**
 * Convert seconds since midnight to 12-hour time format
 * @param seconds - Seconds since midnight (0-86399)
 * @returns Time string in format "H:MM AM/PM" (e.g., "2:30 PM")
 */
export function secondsToTime(seconds: number): string {
  if (seconds < 0 || isNaN(seconds)) return '';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

/**
 * Convert 12-hour time format to seconds since midnight
 * @param time - Time string in format "H:MM AM/PM" (e.g., "2:30 PM")
 * @returns Seconds since midnight (0-86399)
 */
export function timeToSeconds(time: string): number {
  const match = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return 0;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3]?.toUpperCase();

  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;

  return hours * 3600 + minutes * 60;
}

/**
 * Format a Date object to YYYYMMDD format
 * @param date - Date object to format
 * @returns Date string in YYYYMMDD format (e.g., "20260121")
 */
export function formatDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = date.getUTCDate().toString().padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Format YYYYMMDD date to human-readable display format
 * @param yyyymmdd - Date string in YYYYMMDD format (e.g., "20260121")
 * @returns Formatted date (e.g., "Tue, Jan 21, 2026")
 */
export function formatDateDisplay(yyyymmdd: string): string {
  if (!yyyymmdd || yyyymmdd.length !== 8) return yyyymmdd;
  const year = parseInt(yyyymmdd.substring(0, 4), 10);
  const month = parseInt(yyyymmdd.substring(4, 6), 10);
  const day = parseInt(yyyymmdd.substring(6, 8), 10);

  // Create UTC date to get correct day of week (timezone-neutral)
  const date = new Date(Date.UTC(year, month - 1, day));
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dayOfWeek = days[date.getUTCDay()];

  return `${dayOfWeek}, ${months[month - 1]} ${day}, ${year}`;
}

/**
 * Parse YYYYMMDD string to Date object
 * @param yyyymmdd - Date string in YYYYMMDD format
 * @returns Date object (UTC timezone)
 */
export function parseDateYYYYMMDD(yyyymmdd: string): Date {
  if (!yyyymmdd || yyyymmdd.length !== 8) {
    return new Date();
  }
  const year = parseInt(yyyymmdd.substring(0, 4), 10);
  const month = parseInt(yyyymmdd.substring(4, 6), 10) - 1; // Month is 0-indexed
  const day = parseInt(yyyymmdd.substring(6, 8), 10);
  return new Date(Date.UTC(year, month, day));
}

/**
 * Format seconds as duration string
 * @param seconds - Duration in seconds
 * @returns Duration string (e.g., "1h 30m", "45m")
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours > 0) {
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }
  return `${minutes}m`;
}

/**
 * Get current date in YYYYMMDD format (UTC)
 * @returns Today's date as YYYYMMDD string
 */
export function getCurrentDateYYYYMMDD(): string {
  return formatDate(new Date());
}

/**
 * Add days to a YYYYMMDD date string
 * @param yyyymmdd - Base date in YYYYMMDD format
 * @param days - Number of days to add (can be negative)
 * @returns New date in YYYYMMDD format
 */
export function addDaysToDateYYYYMMDD(yyyymmdd: string, days: number): string {
  const date = parseDateYYYYMMDD(yyyymmdd);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDate(date);
}

/**
 * Check if a YYYYMMDD date is in the past
 * @param yyyymmdd - Date to check in YYYYMMDD format
 * @returns true if the date is before today
 */
export function isDateInPast(yyyymmdd: string): boolean {
  const date = parseDateYYYYMMDD(yyyymmdd);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return date < today;
}

/**
 * Check if a YYYYMMDD date is today
 * @param yyyymmdd - Date to check in YYYYMMDD format
 * @returns true if the date is today
 */
export function isToday(yyyymmdd: string): boolean {
  return yyyymmdd === getCurrentDateYYYYMMDD();
}
