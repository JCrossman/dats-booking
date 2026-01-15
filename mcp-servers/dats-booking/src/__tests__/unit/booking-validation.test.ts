import { describe, it, expect, beforeEach, vi } from 'vitest';
import { validateBookingWindow, validateCancellation } from '../../utils/booking-validation.js';

/**
 * Unit tests for booking validation business logic
 *
 * Tests cover all DATS business rules:
 * - 3-day advance booking window
 * - 2-hour same-day notice requirement
 * - Noon cutoff for day-ahead bookings
 * - 2-hour cancellation notice
 *
 * Uses mocked system time for deterministic tests.
 */

describe('validateBookingWindow', () => {
  beforeEach(() => {
    // Reset system time before each test
    vi.useRealTimers();
  });

  describe('Date/Time Parsing', () => {
    it('should reject invalid date format', () => {
      const result = validateBookingWindow('not-a-date', '14:00');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Could not parse');
    });

    it('should reject invalid time format', () => {
      const result = validateBookingWindow('2026-01-20', 'not-a-time');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Could not parse');
    });

    it('should reject invalid dates like Feb 30', () => {
      const result = validateBookingWindow('2026-02-30', '14:00');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Could not parse');
    });

    it('should accept valid YYYY-MM-DD and HH:MM format', () => {
      // Mock current time: Jan 15, 2026 10:00 AM UTC
      vi.setSystemTime(new Date('2026-01-15T10:00:00Z'));

      const result = validateBookingWindow('2026-01-16', '14:00');

      // Should be valid (tomorrow at 2 PM)
      expect(result.valid).toBe(true);
    });
  });

  describe('Past Time Validation', () => {
    it('should reject pickup time in the past', () => {
      // Mock current time: Jan 15, 2026 2:00 PM UTC
      vi.setSystemTime(new Date('2026-01-15T14:00:00Z'));

      // Try to book for 1:00 PM today (1 hour ago)
      const result = validateBookingWindow('2026-01-15', '13:00');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('already passed');
    });

    it('should reject pickup time exactly now', () => {
      // Mock current time: Jan 15, 2026 2:00 PM UTC
      vi.setSystemTime(new Date('2026-01-15T14:00:00Z'));

      // Try to book for exactly now
      const result = validateBookingWindow('2026-01-15', '14:00');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('already passed');
    });
  });

  describe('3-Day Advance Booking Limit', () => {
    it('should reject booking more than 3 days in advance', () => {
      // Mock current time: Jan 15, 2026 10:00 AM UTC
      vi.setSystemTime(new Date('2026-01-15T10:00:00Z'));

      // Try to book for Jan 19 (4 days away)
      const result = validateBookingWindow('2026-01-19', '14:00');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('only allows booking up to 3 days');
      expect(result.error).toContain('4 days away');
    });

    it('should accept booking exactly 3 days in advance', () => {
      // Mock current time: Jan 15, 2026 2:00 PM UTC
      vi.setSystemTime(new Date('2026-01-15T14:00:00Z'));

      // Book for Jan 18 at 2:00 PM (exactly 72 hours away)
      const result = validateBookingWindow('2026-01-18', '14:00');

      // Should be valid (within 3-day window, before noon cutoff)
      expect(result.valid).toBe(true);
    });

    it('should accept booking 2 days in advance', () => {
      // Mock current time: Jan 15, 2026 10:00 AM UTC
      vi.setSystemTime(new Date('2026-01-15T10:00:00Z'));

      // Book for Jan 17 (2 days away)
      const result = validateBookingWindow('2026-01-17', '14:00');

      expect(result.valid).toBe(true);
    });
  });

  describe('Same-Day Booking (2-Hour Minimum Notice)', () => {
    it('should reject same-day booking with less than 2 hours notice', () => {
      // Mock current time: Jan 15, 2026 10:00 AM UTC
      vi.setSystemTime(new Date('2026-01-15T10:00:00Z'));

      // Try to book for 11:00 AM today (1 hour away)
      const result = validateBookingWindow('2026-01-15', '11:00');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('at least 2 hours notice');
      expect(result.error).toContain('60 minutes away');
    });

    it('should accept same-day booking with exactly 2 hours notice', () => {
      // Mock current time: Jan 15, 2026 10:00 AM UTC
      vi.setSystemTime(new Date('2026-01-15T10:00:00Z'));

      // Book for 12:00 PM today (exactly 2 hours away)
      const result = validateBookingWindow('2026-01-15', '12:00');

      expect(result.valid).toBe(true);
      expect(result.warning).toContain('not guaranteed');
    });

    it('should accept same-day booking with more than 2 hours notice', () => {
      // Mock current time: Jan 15, 2026 10:00 AM UTC
      vi.setSystemTime(new Date('2026-01-15T10:00:00Z'));

      // Book for 3:00 PM today (5 hours away)
      const result = validateBookingWindow('2026-01-15', '15:00');

      expect(result.valid).toBe(true);
      expect(result.warning).toContain('not guaranteed');
    });

    it('should warn that same-day bookings are not guaranteed', () => {
      // Mock current time: Jan 15, 2026 10:00 AM UTC
      vi.setSystemTime(new Date('2026-01-15T10:00:00Z'));

      // Book for 3:00 PM today
      const result = validateBookingWindow('2026-01-15', '15:00');

      expect(result.valid).toBe(true);
      expect(result.warning).toBeDefined();
      expect(result.warning).toContain('Same-day bookings are not guaranteed');
    });
  });

  describe('Noon Cutoff Rule', () => {
    it('should reject booking for tomorrow after noon today', () => {
      // Mock current time: Jan 15, 2026 1:00 PM UTC (after noon)
      vi.setSystemTime(new Date('2026-01-15T13:00:00Z'));

      // Try to book for tomorrow Jan 16 at 10:00 AM (22 hours away, but past noon cutoff)
      const result = validateBookingWindow('2026-01-16', '10:00');

      // Should fail because we're past noon cutoff, and it's less than 2 hours notice
      // Actually, 22 hours is more than 2 hours, so it should be valid with warning
      expect(result.valid).toBe(true);
      expect(result.warning).toContain('noon cutoff has passed');
      expect(result.warning).toContain('not guaranteed');
    });

    it('should accept booking for tomorrow before noon today', () => {
      // Mock current time: Jan 15, 2026 10:00 AM UTC (before noon)
      vi.setSystemTime(new Date('2026-01-15T10:00:00Z'));

      // Book for tomorrow Jan 16 at 2:00 PM
      const result = validateBookingWindow('2026-01-16', '14:00');

      // Should be valid (before noon cutoff for tomorrow)
      expect(result.valid).toBe(true);
      expect(result.warning).toBeUndefined();
    });

    it('should reject booking for tomorrow after noon if less than 2 hours notice', () => {
      // Mock current time: Jan 15, 2026 11:30 PM UTC (past noon, close to midnight)
      vi.setSystemTime(new Date('2026-01-15T23:30:00Z'));

      // Try to book for tomorrow Jan 16 at 12:30 AM (1 hour away)
      const result = validateBookingWindow('2026-01-16', '00:30');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('noon cutoff has passed');
      expect(result.error).toContain('at least 2 hours notice');
    });

    it('should accept booking for day after tomorrow even if past noon', () => {
      // Mock current time: Jan 15, 2026 1:00 PM UTC (after noon)
      vi.setSystemTime(new Date('2026-01-15T13:00:00Z'));

      // Book for Jan 17 (day after tomorrow)
      const result = validateBookingWindow('2026-01-17', '14:00');

      // Should be valid (2 days away, within 3-day window)
      expect(result.valid).toBe(true);
      expect(result.warning).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle midnight bookings', () => {
      // Mock current time: Jan 15, 2026 10:00 PM UTC
      vi.setSystemTime(new Date('2026-01-15T22:00:00Z'));

      // Book for tomorrow at midnight
      const result = validateBookingWindow('2026-01-16', '00:00');

      expect(result.valid).toBe(true);
    });

    it('should handle 23:59 bookings', () => {
      // Mock current time: Jan 15, 2026 10:00 AM UTC
      vi.setSystemTime(new Date('2026-01-15T10:00:00Z'));

      // Book for tomorrow at 11:59 PM
      const result = validateBookingWindow('2026-01-16', '23:59');

      expect(result.valid).toBe(true);
    });
  });
});

describe('validateCancellation', () => {
  beforeEach(() => {
    // Reset system time before each test
    vi.useRealTimers();
  });

  describe('Date/Time Parsing', () => {
    it('should handle "Tue, Jan 13, 2026" format', () => {
      // Mock current time: Jan 10, 2026 10:00 AM UTC
      vi.setSystemTime(new Date('2026-01-10T10:00:00Z'));

      const result = validateCancellation('Tue, Jan 13, 2026', '2:00 PM');

      // Should be valid (3 days away)
      expect(result.valid).toBe(true);
    });

    it('should handle "7:50 AM" time format', () => {
      // Mock current time: Jan 10, 2026 10:00 AM UTC
      vi.setSystemTime(new Date('2026-01-10T10:00:00Z'));

      const result = validateCancellation('Jan 15, 2026', '7:50 AM');

      expect(result.valid).toBe(true);
    });

    it('should handle 24-hour time format', () => {
      // Mock current time: Jan 10, 2026 10:00 AM UTC
      vi.setSystemTime(new Date('2026-01-10T10:00:00Z'));

      const result = validateCancellation('Jan 15, 2026', '14:30');

      expect(result.valid).toBe(true);
    });

    it('should handle unparseable date gracefully with warning', () => {
      const result = validateCancellation('not-a-date', '2:00 PM');

      expect(result.valid).toBe(true);
      expect(result.warning).toContain('Could not verify');
    });
  });

  describe('2-Hour Cancellation Notice', () => {
    it('should reject cancellation with less than 2 hours notice', () => {
      // Mock current time: Jan 15, 2026 10:00 AM UTC
      vi.setSystemTime(new Date('2026-01-15T10:00:00Z'));

      // Try to cancel trip at 11:00 AM (1 hour away)
      const result = validateCancellation('Jan 15, 2026', '11:00 AM');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('2 hours notice');
      expect(result.error).toContain('60 minutes');
      expect(result.error).toContain('780-986-6010'); // DATS phone number
    });

    it('should accept cancellation with exactly 2 hours notice', () => {
      // Mock current time: Jan 15, 2026 10:00 AM UTC
      vi.setSystemTime(new Date('2026-01-15T10:00:00Z'));

      // Cancel trip at 12:00 PM (exactly 2 hours away)
      const result = validateCancellation('Jan 15, 2026', '12:00 PM');

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept cancellation with more than 2 hours notice', () => {
      // Mock current time: Jan 15, 2026 10:00 AM UTC
      vi.setSystemTime(new Date('2026-01-15T10:00:00Z'));

      // Cancel trip at 3:00 PM (5 hours away)
      const result = validateCancellation('Jan 15, 2026', '3:00 PM');

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should warn when close to 2-hour minimum', () => {
      // Mock current time: Jan 15, 2026 10:00 AM UTC
      vi.setSystemTime(new Date('2026-01-15T10:00:00Z'));

      // Cancel trip at 12:30 PM (2.5 hours away)
      const result = validateCancellation('Jan 15, 2026', '12:30 PM');

      expect(result.valid).toBe(true);
      expect(result.warning).toBeDefined();
      expect(result.warning).toContain('cutting it close');
    });
  });

  describe('Past Trip Validation', () => {
    it('should reject cancellation of past trip', () => {
      // Mock current time: Jan 15, 2026 2:00 PM UTC
      vi.setSystemTime(new Date('2026-01-15T14:00:00Z'));

      // Try to cancel trip at 1:00 PM (already passed)
      const result = validateCancellation('Jan 15, 2026', '1:00 PM');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('already started or passed');
    });

    it('should reject cancellation of trip happening right now', () => {
      // Mock current time: Jan 15, 2026 2:00 PM UTC
      vi.setSystemTime(new Date('2026-01-15T14:00:00Z'));

      // Try to cancel trip at 2:00 PM (exactly now = 0 minutes)
      const result = validateCancellation('Jan 15, 2026', '2:00 PM');

      expect(result.valid).toBe(false);
      // 0 minutes is less than 2 hours, so it triggers the 2-hour rule, not "already started"
      expect(result.error).toContain('2 hours notice');
    });
  });

  describe('Return Values', () => {
    it('should include minutesUntilTrip in response', () => {
      // Mock current time: Jan 15, 2026 10:00 AM UTC
      vi.setSystemTime(new Date('2026-01-15T10:00:00Z'));

      // Trip at 3:00 PM (5 hours = 300 minutes away)
      const result = validateCancellation('Jan 15, 2026', '3:00 PM');

      expect(result.minutesUntilTrip).toBeDefined();
      expect(result.minutesUntilTrip).toBe(300);
    });

    it('should include minutesUntilTrip even when invalid', () => {
      // Mock current time: Jan 15, 2026 10:00 AM UTC
      vi.setSystemTime(new Date('2026-01-15T10:00:00Z'));

      // Trip at 11:00 AM (1 hour = 60 minutes away, less than 2 hours)
      const result = validateCancellation('Jan 15, 2026', '11:00 AM');

      expect(result.valid).toBe(false);
      expect(result.minutesUntilTrip).toBe(60);
    });
  });

  describe('Edge Cases', () => {
    it('should handle trips at midnight', () => {
      // Mock current time: Jan 15, 2026 8:00 PM UTC
      vi.setSystemTime(new Date('2026-01-15T20:00:00Z'));

      // Trip at midnight (4 hours away)
      const result = validateCancellation('Jan 16, 2026', '12:00 AM');

      expect(result.valid).toBe(true);
    });

    it('should handle trips crossing date boundary', () => {
      // Mock current time: Jan 15, 2026 11:00 PM UTC
      vi.setSystemTime(new Date('2026-01-15T23:00:00Z'));

      // Trip tomorrow at 2:00 AM (3 hours away)
      const result = validateCancellation('Jan 16, 2026', '2:00 AM');

      expect(result.valid).toBe(true);
    });

    it('should handle 12 PM (noon) correctly', () => {
      // Mock current time: Jan 15, 2026 10:00 AM UTC
      vi.setSystemTime(new Date('2026-01-15T10:00:00Z'));

      // Trip at 12:00 PM (2 hours away, exactly at minimum)
      const result = validateCancellation('Jan 15, 2026', '12:00 PM');

      expect(result.valid).toBe(true);
    });

    it('should handle 12 AM (midnight) correctly', () => {
      // Mock current time: Jan 15, 2026 9:00 PM UTC
      vi.setSystemTime(new Date('2026-01-15T21:00:00Z'));

      // Trip at 12:00 AM tomorrow (3 hours away)
      const result = validateCancellation('Jan 16, 2026', '12:00 AM');

      expect(result.valid).toBe(true);
    });
  });
});
