/**
 * Tests for booking window validation
 */

import { describe, it, expect } from 'vitest';
import {
  validateBookingWindow,
  validateCancellation,
  formatDuration,
} from '../../src/utils/booking-validation.js';

describe('validateBookingWindow', () => {
  // Use a fixed "now" for predictable tests
  const mockNow = new Date('2026-01-11T10:00:00'); // Saturday, January 11, 2026, 10:00 AM

  describe('past dates', () => {
    it('should reject pickup times in the past', () => {
      const result = validateBookingWindow('2026-01-11', '08:00', mockNow);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('already passed');
    });

    it('should reject pickup dates in the past', () => {
      const result = validateBookingWindow('2026-01-10', '14:00', mockNow);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('already passed');
    });
  });

  describe('advance booking limits', () => {
    it('should reject bookings more than 3 days in advance', () => {
      const result = validateBookingWindow('2026-01-20', '10:00', mockNow);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('3 days in advance');
    });

    it('should accept bookings within 3-day window', () => {
      const result = validateBookingWindow('2026-01-13', '10:00', mockNow);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('same-day booking rules', () => {
    it('should reject same-day booking with less than 2 hours notice', () => {
      const result = validateBookingWindow('2026-01-11', '11:00', mockNow);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('2 hours notice');
    });

    it('should accept same-day booking with 2+ hours notice but warn', () => {
      const result = validateBookingWindow('2026-01-11', '14:00', mockNow);
      expect(result.valid).toBe(true);
      expect(result.warning).toContain('not guaranteed');
    });
  });

  describe('noon cutoff rule', () => {
    it('should apply same-day rules after noon cutoff for tomorrow', () => {
      // It's 2pm on Jan 11 (past noon), booking for Jan 12
      const afternoonNow = new Date('2026-01-11T14:00:00');
      const result = validateBookingWindow('2026-01-12', '10:00', afternoonNow);

      // Should still be valid (20 hours notice) but with warning
      expect(result.valid).toBe(true);
      expect(result.warning).toContain('noon cutoff');
    });

    it('should accept booking before noon cutoff', () => {
      // It's 10am on Jan 11 (before noon), booking for Jan 12
      const result = validateBookingWindow('2026-01-12', '10:00', mockNow);
      expect(result.valid).toBe(true);
      expect(result.warning).toBeUndefined();
    });
  });

  describe('date/time parsing', () => {
    it('should reject invalid date format', () => {
      const result = validateBookingWindow('01-11-2026', '10:00', mockNow);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('parse');
    });

    it('should reject invalid time format', () => {
      const result = validateBookingWindow('2026-01-12', '25:00', mockNow);
      expect(result.valid).toBe(false);
    });

    it('should reject invalid dates like Feb 30', () => {
      const result = validateBookingWindow('2026-02-30', '10:00', mockNow);
      expect(result.valid).toBe(false);
    });
  });
});

describe('validateCancellation', () => {
  const mockNow = new Date('2026-01-11T10:00:00');

  describe('2-hour notice rule', () => {
    it('should reject cancellation less than 2 hours before trip', () => {
      // Trip at 11:00 AM, it's 10:00 AM (only 1 hour notice)
      const result = validateCancellation('2026-01-11', '11:00 AM', mockNow);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('2 hours notice');
      expect(result.error).toContain('780-986-6010'); // DATS phone number
    });

    it('should accept cancellation with more than 2 hours notice', () => {
      // Trip at 2:00 PM, it's 10:00 AM (4 hours notice)
      const result = validateCancellation('2026-01-11', '2:00 PM', mockNow);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should warn when cancellation is between 2-3 hours', () => {
      // Trip at 12:30 PM, it's 10:00 AM (2.5 hours notice)
      const result = validateCancellation('2026-01-11', '12:30 PM', mockNow);
      expect(result.valid).toBe(true);
      expect(result.warning).toContain('cancel early');
    });
  });

  describe('past trips', () => {
    it('should reject cancellation of trips that have already started', () => {
      const result = validateCancellation('2026-01-11', '9:00 AM', mockNow);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('already started');
    });
  });

  describe('date format handling', () => {
    it('should handle YYYY-MM-DD format', () => {
      const result = validateCancellation('2026-01-12', '10:00 AM', mockNow);
      expect(result.valid).toBe(true);
    });

    it('should handle YYYYMMDD format', () => {
      const result = validateCancellation('20260112', '10:00 AM', mockNow);
      expect(result.valid).toBe(true);
    });

    it('should handle human-readable date format', () => {
      const result = validateCancellation('Jan 12, 2026', '10:00 AM', mockNow);
      expect(result.valid).toBe(true);
    });

    it('should handle 24-hour time format', () => {
      const result = validateCancellation('2026-01-11', '14:00', mockNow);
      expect(result.valid).toBe(true);
    });
  });

  describe('unparseable dates', () => {
    it('should allow cancellation with warning if date cannot be parsed', () => {
      const result = validateCancellation('garbage', '10:00 AM', mockNow);
      expect(result.valid).toBe(true);
      expect(result.warning).toContain('verify');
    });
  });
});

describe('formatDuration', () => {
  it('should format minutes under an hour', () => {
    expect(formatDuration(45)).toBe('45 minutes');
  });

  it('should format exactly one hour', () => {
    expect(formatDuration(60)).toBe('1 hour');
  });

  it('should format multiple hours', () => {
    expect(formatDuration(180)).toBe('3 hours');
  });

  it('should format hours and minutes', () => {
    expect(formatDuration(90)).toBe('1 hour and 30 minutes');
    expect(formatDuration(150)).toBe('2 hours and 30 minutes');
  });
});
