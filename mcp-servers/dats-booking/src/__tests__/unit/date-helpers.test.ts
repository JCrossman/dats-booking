import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  parseFlexibleDate,
  formatDateYMD,
  normalizeTripDate,
  getCurrentDateInfo,
} from '../../helpers/date-helpers.js';

/**
 * Unit tests for date helper functions
 *
 * Tests cover:
 * - Flexible date parsing (relative dates, day names)
 * - Date formatting
 * - DATS API date normalization
 * - Timezone-aware current date info
 *
 * Uses mocked system time for deterministic tests.
 */

describe('parseFlexibleDate', () => {
  beforeEach(() => {
    // Reset system time before each test
    vi.useRealTimers();
  });

  describe('YYYY-MM-DD Passthrough', () => {
    it('should return YYYY-MM-DD format unchanged', () => {
      const result = parseFlexibleDate('2026-01-15');

      expect(result).toBe('2026-01-15');
    });

    it('should handle different dates in YYYY-MM-DD format', () => {
      expect(parseFlexibleDate('2025-12-31')).toBe('2025-12-31');
      expect(parseFlexibleDate('2026-06-15')).toBe('2026-06-15');
      expect(parseFlexibleDate('2027-02-28')).toBe('2027-02-28');
    });
  });

  describe('Relative Date Keywords', () => {
    it('should parse "today" to current date', () => {
      // Mock current date: Jan 15, 2026 in Edmonton timezone
      vi.setSystemTime(new Date('2026-01-15T17:00:00Z')); // 10:00 AM MST

      const result = parseFlexibleDate('today', 'America/Edmonton');

      expect(result).toBe('2026-01-15');
    });

    it('should parse "tomorrow" to next day', () => {
      // Mock current date: Jan 15, 2026
      vi.setSystemTime(new Date('2026-01-15T17:00:00Z'));

      const result = parseFlexibleDate('tomorrow', 'America/Edmonton');

      expect(result).toBe('2026-01-16');
    });

    it('should parse "yesterday" to previous day', () => {
      // Mock current date: Jan 15, 2026
      vi.setSystemTime(new Date('2026-01-15T17:00:00Z'));

      const result = parseFlexibleDate('yesterday', 'America/Edmonton');

      expect(result).toBe('2026-01-14');
    });

    it('should be case-insensitive', () => {
      vi.setSystemTime(new Date('2026-01-15T17:00:00Z'));

      expect(parseFlexibleDate('TODAY', 'America/Edmonton')).toBe('2026-01-15');
      expect(parseFlexibleDate('Tomorrow', 'America/Edmonton')).toBe('2026-01-16');
      expect(parseFlexibleDate('YESTERDAY', 'America/Edmonton')).toBe('2026-01-14');
    });

    it('should handle whitespace', () => {
      vi.setSystemTime(new Date('2026-01-15T17:00:00Z'));

      expect(parseFlexibleDate('  today  ', 'America/Edmonton')).toBe('2026-01-15');
      expect(parseFlexibleDate(' tomorrow ', 'America/Edmonton')).toBe('2026-01-16');
    });
  });

  describe('Day Names', () => {
    it('should parse day names to next occurrence', () => {
      // Mock current date: Thursday, Jan 15, 2026
      vi.setSystemTime(new Date('2026-01-15T17:00:00Z'));

      // Next Friday is Jan 16
      expect(parseFlexibleDate('friday', 'America/Edmonton')).toBe('2026-01-16');

      // Next Saturday is Jan 17
      expect(parseFlexibleDate('saturday', 'America/Edmonton')).toBe('2026-01-17');

      // Next Sunday is Jan 18
      expect(parseFlexibleDate('sunday', 'America/Edmonton')).toBe('2026-01-18');

      // Next Monday is Jan 19
      expect(parseFlexibleDate('monday', 'America/Edmonton')).toBe('2026-01-19');
    });

    it('should move to next week if day has passed', () => {
      // Mock current date: Thursday, Jan 15, 2026
      vi.setSystemTime(new Date('2026-01-15T17:00:00Z'));

      // Next Tuesday is Jan 20 (next week, since Tuesday already passed)
      expect(parseFlexibleDate('tuesday', 'America/Edmonton')).toBe('2026-01-20');

      // Next Wednesday is Jan 21
      expect(parseFlexibleDate('wednesday', 'America/Edmonton')).toBe('2026-01-21');
    });

    it('should move to next week if same day', () => {
      // Mock current date: Thursday, Jan 15, 2026
      vi.setSystemTime(new Date('2026-01-15T17:00:00Z'));

      // Next Thursday is Jan 22 (next week)
      expect(parseFlexibleDate('thursday', 'America/Edmonton')).toBe('2026-01-22');
    });

    it('should handle all day names', () => {
      // Mock current date: Thursday, Jan 15, 2026
      vi.setSystemTime(new Date('2026-01-15T17:00:00Z'));

      const results = {
        sunday: parseFlexibleDate('sunday', 'America/Edmonton'),
        monday: parseFlexibleDate('monday', 'America/Edmonton'),
        tuesday: parseFlexibleDate('tuesday', 'America/Edmonton'),
        wednesday: parseFlexibleDate('wednesday', 'America/Edmonton'),
        thursday: parseFlexibleDate('thursday', 'America/Edmonton'),
        friday: parseFlexibleDate('friday', 'America/Edmonton'),
        saturday: parseFlexibleDate('saturday', 'America/Edmonton'),
      };

      // All results should be valid dates
      Object.values(results).forEach((date) => {
        expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
    });

    it('should be case-insensitive for day names', () => {
      vi.setSystemTime(new Date('2026-01-15T17:00:00Z'));

      expect(parseFlexibleDate('FRIDAY', 'America/Edmonton')).toBe('2026-01-16');
      expect(parseFlexibleDate('Friday', 'America/Edmonton')).toBe('2026-01-16');
      expect(parseFlexibleDate('friday', 'America/Edmonton')).toBe('2026-01-16');
    });
  });

  describe('"next" Prefix', () => {
    it('should parse "next monday"', () => {
      // Mock current date: Thursday, Jan 15, 2026
      vi.setSystemTime(new Date('2026-01-15T17:00:00Z'));

      // Next Monday is Jan 19
      expect(parseFlexibleDate('next monday', 'America/Edmonton')).toBe('2026-01-19');
    });

    it('should parse "next" for all days', () => {
      // Mock current date: Thursday, Jan 15, 2026
      vi.setSystemTime(new Date('2026-01-15T17:00:00Z'));

      expect(parseFlexibleDate('next sunday', 'America/Edmonton')).toBe('2026-01-18');
      expect(parseFlexibleDate('next monday', 'America/Edmonton')).toBe('2026-01-19');
      expect(parseFlexibleDate('next friday', 'America/Edmonton')).toBe('2026-01-16');
    });

    it('should move to next week for same day with "next"', () => {
      // Mock current date: Thursday, Jan 15, 2026
      vi.setSystemTime(new Date('2026-01-15T17:00:00Z'));

      // "next thursday" should be Jan 22, not today
      expect(parseFlexibleDate('next thursday', 'America/Edmonton')).toBe('2026-01-22');
    });

    it('should be case-insensitive', () => {
      vi.setSystemTime(new Date('2026-01-15T17:00:00Z'));

      expect(parseFlexibleDate('NEXT MONDAY', 'America/Edmonton')).toBe('2026-01-19');
      expect(parseFlexibleDate('Next Monday', 'America/Edmonton')).toBe('2026-01-19');
    });
  });

  describe('Timezone Handling', () => {
    it('should use America/Edmonton timezone by default', () => {
      // Mock Jan 15, 2026 at 7:00 AM UTC (midnight in Edmonton)
      vi.setSystemTime(new Date('2026-01-15T07:00:00Z'));

      // Should still be Jan 15 in Edmonton
      const result = parseFlexibleDate('today');

      expect(result).toBe('2026-01-15');
    });

    it('should respect different timezones', () => {
      // Mock Jan 15, 2026 at 11:00 PM UTC
      vi.setSystemTime(new Date('2026-01-15T23:00:00Z'));

      // In UTC, it's Jan 15
      const utcResult = parseFlexibleDate('today', 'UTC');
      expect(utcResult).toBe('2026-01-15');

      // In America/Edmonton (MST -7), it's still Jan 15 (4:00 PM)
      const edmontonResult = parseFlexibleDate('today', 'America/Edmonton');
      expect(edmontonResult).toBe('2026-01-15');

      // In Asia/Tokyo (+9), it's Jan 16
      const tokyoResult = parseFlexibleDate('today', 'Asia/Tokyo');
      expect(tokyoResult).toBe('2026-01-16');
    });
  });

  describe('Invalid Input', () => {
    it('should return input as-is for unrecognized format', () => {
      const result = parseFlexibleDate('invalid-date-string');

      expect(result).toBe('invalid-date-string');
    });

    it('should return partial dates as-is', () => {
      expect(parseFlexibleDate('2026-01')).toBe('2026-01');
      expect(parseFlexibleDate('jan 15')).toBe('jan 15');
    });
  });
});

describe('formatDateYMD', () => {
  it('should format UTC date as YYYY-MM-DD', () => {
    const date = new Date(Date.UTC(2026, 0, 15)); // Jan 15, 2026

    expect(formatDateYMD(date)).toBe('2026-01-15');
  });

  it('should pad single-digit months and days', () => {
    const date = new Date(Date.UTC(2026, 0, 5)); // Jan 5, 2026

    expect(formatDateYMD(date)).toBe('2026-01-05');
  });

  it('should handle December 31', () => {
    const date = new Date(Date.UTC(2025, 11, 31)); // Dec 31, 2025

    expect(formatDateYMD(date)).toBe('2025-12-31');
  });

  it('should handle January 1', () => {
    const date = new Date(Date.UTC(2026, 0, 1)); // Jan 1, 2026

    expect(formatDateYMD(date)).toBe('2026-01-01');
  });

  it('should handle leap year February 29', () => {
    const date = new Date(Date.UTC(2024, 1, 29)); // Feb 29, 2024 (leap year)

    expect(formatDateYMD(date)).toBe('2024-02-29');
  });

  it('should use UTC, not local time', () => {
    // Create a date at 11 PM UTC on Jan 15
    const date = new Date(Date.UTC(2026, 0, 15, 23, 0, 0));

    // Should still be Jan 15 (uses UTC, not local)
    expect(formatDateYMD(date)).toBe('2026-01-15');
  });
});

describe('normalizeTripDate', () => {
  describe('YYYY-MM-DD Passthrough', () => {
    it('should return YYYY-MM-DD format unchanged', () => {
      expect(normalizeTripDate('2026-01-15')).toBe('2026-01-15');
      expect(normalizeTripDate('2025-12-31')).toBe('2025-12-31');
    });
  });

  describe('DATS API Date Formats', () => {
    it('should parse "Tue, Jan 13, 2026" format', () => {
      const result = normalizeTripDate('Tue, Jan 13, 2026');

      expect(result).toBe('2026-01-13');
    });

    it('should parse "Mon, Dec 25, 2025" format', () => {
      const result = normalizeTripDate('Mon, Dec 25, 2025');

      expect(result).toBe('2025-12-25');
    });

    it('should parse without day name: "Jan 15, 2026"', () => {
      const result = normalizeTripDate('Jan 15, 2026');

      expect(result).toBe('2026-01-15');
    });

    it('should parse without comma: "Jan 15 2026"', () => {
      const result = normalizeTripDate('Jan 15 2026');

      expect(result).toBe('2026-01-15');
    });

    it('should handle all month abbreviations', () => {
      const months = [
        { abbr: 'Jan', num: '01' },
        { abbr: 'Feb', num: '02' },
        { abbr: 'Mar', num: '03' },
        { abbr: 'Apr', num: '04' },
        { abbr: 'May', num: '05' },
        { abbr: 'Jun', num: '06' },
        { abbr: 'Jul', num: '07' },
        { abbr: 'Aug', num: '08' },
        { abbr: 'Sep', num: '09' },
        { abbr: 'Oct', num: '10' },
        { abbr: 'Nov', num: '11' },
        { abbr: 'Dec', num: '12' },
      ];

      months.forEach(({ abbr, num }) => {
        const result = normalizeTripDate(`${abbr} 15, 2026`);
        expect(result).toBe(`2026-${num}-15`);
      });
    });

    it('should pad single-digit days', () => {
      expect(normalizeTripDate('Jan 5, 2026')).toBe('2026-01-05');
      expect(normalizeTripDate('Feb 9, 2026')).toBe('2026-02-09');
    });

    it('should handle full month names (first 3 chars)', () => {
      expect(normalizeTripDate('January 15, 2026')).toBe('2026-01-15');
      expect(normalizeTripDate('February 9, 2026')).toBe('2026-02-09');
      expect(normalizeTripDate('December 25, 2025')).toBe('2025-12-25');
    });

    it('should be case-insensitive', () => {
      expect(normalizeTripDate('JAN 15, 2026')).toBe('2026-01-15');
      expect(normalizeTripDate('jan 15, 2026')).toBe('2026-01-15');
      expect(normalizeTripDate('Jan 15, 2026')).toBe('2026-01-15');
    });
  });

  describe('Invalid Formats', () => {
    it('should return empty string for unparseable date', () => {
      expect(normalizeTripDate('not-a-date')).toBe('');
      expect(normalizeTripDate('invalid')).toBe('');
      expect(normalizeTripDate('')).toBe('');
    });

    it('should return empty string for unknown month', () => {
      expect(normalizeTripDate('Xyz 15, 2026')).toBe('');
    });
  });
});

describe('getCurrentDateInfo', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('should return today and day of week in America/Edmonton', () => {
    // Mock Jan 15, 2026 10:00 AM MST (17:00 UTC)
    vi.setSystemTime(new Date('2026-01-15T17:00:00Z'));

    const result = getCurrentDateInfo('America/Edmonton');

    expect(result.today).toBe('2026-01-15');
    expect(result.dayOfWeek).toBe('Thursday');
  });

  it('should use America/Edmonton by default', () => {
    // Mock Jan 15, 2026 10:00 AM MST
    vi.setSystemTime(new Date('2026-01-15T17:00:00Z'));

    const result = getCurrentDateInfo();

    expect(result.today).toBe('2026-01-15');
    expect(result.dayOfWeek).toBe('Thursday');
  });

  it('should handle different timezones', () => {
    // Mock Jan 15, 2026 11:00 PM UTC
    vi.setSystemTime(new Date('2026-01-15T23:00:00Z'));

    // UTC: Jan 15
    const utcResult = getCurrentDateInfo('UTC');
    expect(utcResult.today).toBe('2026-01-15');
    expect(utcResult.dayOfWeek).toBe('Thursday');

    // America/Edmonton (MST -7): Jan 15, 4:00 PM
    const edmontonResult = getCurrentDateInfo('America/Edmonton');
    expect(edmontonResult.today).toBe('2026-01-15');
    expect(edmontonResult.dayOfWeek).toBe('Thursday');

    // Asia/Tokyo (+9): Jan 16, 8:00 AM
    const tokyoResult = getCurrentDateInfo('Asia/Tokyo');
    expect(tokyoResult.today).toBe('2026-01-16');
    expect(tokyoResult.dayOfWeek).toBe('Friday');
  });

  it('should handle weekend days', () => {
    // Mock Saturday, Jan 17, 2026
    vi.setSystemTime(new Date('2026-01-17T17:00:00Z'));

    const result = getCurrentDateInfo('America/Edmonton');

    expect(result.dayOfWeek).toBe('Saturday');
  });

  it('should handle Sunday', () => {
    // Mock Sunday, Jan 18, 2026
    vi.setSystemTime(new Date('2026-01-18T17:00:00Z'));

    const result = getCurrentDateInfo('America/Edmonton');

    expect(result.dayOfWeek).toBe('Sunday');
  });

  it('should format dates with zero-padding', () => {
    // Mock Jan 5, 2026 (single-digit day)
    vi.setSystemTime(new Date('2026-01-05T17:00:00Z'));

    const result = getCurrentDateInfo('America/Edmonton');

    expect(result.today).toBe('2026-01-05');
  });
});
