/**
 * DATS Business Rules and System Constants
 *
 * This file centralizes all magic numbers and configuration values
 * used throughout the application. Update these values when DATS
 * policies change.
 *
 * DO NOT hardcode these values elsewhere - import from this file instead.
 */

/**
 * DATS booking and cancellation policies
 *
 * These values reflect DATS business rules as of January 2026.
 * See: https://www.edmonton.ca/transportation/dats
 */
export const DATS_BUSINESS_RULES = {
  /** Maximum days in advance you can book a trip */
  ADVANCE_BOOKING_MAX_DAYS: 3,

  /** Minimum hours notice for same-day bookings */
  SAME_DAY_MIN_HOURS: 2,

  /** Minimum hours notice to cancel a trip */
  CANCELLATION_MIN_HOURS: 2,

  /** Hour when day-ahead booking cutoff occurs (noon in 24-hour format) */
  NOON_CUTOFF_HOUR: 12,

  /** Duration of pickup time window in minutes */
  PICKUP_WINDOW_MINUTES: 30,

  /** Maximum time vehicle waits at pickup in minutes */
  VEHICLE_WAIT_MINUTES: 5,

  /** Maximum minutes before pickup when trip tracking becomes available */
  TRACKING_AVAILABILITY_MINUTES: 60,
} as const;

/**
 * Time conversion constants
 *
 * Use these for all time calculations to avoid magic numbers
 */
export const TIME_CONSTANTS = {
  MINUTES_PER_HOUR: 60,
  HOURS_PER_DAY: 24,
  DAYS_PER_WEEK: 7,
  MILLISECONDS_PER_SECOND: 1000,
  MILLISECONDS_PER_MINUTE: 60_000,
} as const;

/**
 * API and system configuration
 */
export const API_CONSTANTS = {
  /** DATS SOAP API base URL */
  DATS_API_URL: 'https://datsonlinebooking.edmonton.ca/PassInfoServer',

  /** DATS async API URL */
  DATS_API_ASYNC_URL: 'https://datsonlinebooking.edmonton.ca/PassInfoServerAsync',

  /** DATS remarks/announcements endpoint */
  DATS_REMARKS_URL: 'https://datsonlinebooking.edmonton.ca/Remarks',

  /** Maximum characters for debug log truncation */
  DEBUG_LOG_MAX_LENGTH: 500,

  /** Default HTTP server port */
  DEFAULT_HTTP_PORT: 3000,

  /** Default server host */
  DEFAULT_HTTP_HOST: '0.0.0.0',

  /** Default timezone for DATS users (Edmonton, Alberta) */
  DEFAULT_TIMEZONE: 'America/Edmonton',
} as const;

/**
 * Month name to number mapping for date parsing
 *
 * Used to parse dates like "Jan 15, 2026" from DATS API responses
 */
export const MONTH_NAMES: Record<string, string> = {
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  aug: '08',
  sep: '09',
  oct: '10',
  nov: '11',
  dec: '12',
} as const;

/**
 * Day names for date parsing
 *
 * Used to parse relative dates like "next monday"
 * Index matches JavaScript Date.getDay() (0 = Sunday)
 */
export const DAY_NAMES = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

/**
 * Encryption and security constants
 */
export const SECURITY_CONSTANTS = {
  /** AES encryption algorithm */
  ENCRYPTION_ALGORITHM: 'aes-256-gcm' as const,

  /** Encryption key length in bytes */
  ENCRYPTION_KEY_LENGTH: 32,

  /** Initialization vector length in bytes */
  ENCRYPTION_IV_LENGTH: 16,

  /** Salt for key derivation (DO NOT CHANGE - would invalidate existing sessions) */
  ENCRYPTION_SALT: 'dats-booking-mcp-salt',
} as const;

/**
 * Numeric padding constants
 */
export const PADDING = {
  /** Zero-pad month/day to 2 digits */
  DATE_COMPONENT: 2,

  /** Character used for padding */
  PAD_CHAR: '0',
} as const;

/**
 * HTTP and networking constants
 */
export const HTTP_CONSTANTS = {
  /** Standard timeout for API requests in milliseconds */
  DEFAULT_TIMEOUT_MS: 30000,

  /** Timeout for authentication requests in milliseconds */
  AUTH_TIMEOUT_MS: 60000,
} as const;
