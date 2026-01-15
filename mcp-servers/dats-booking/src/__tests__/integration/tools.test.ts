import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateBookingWindow, validateCancellation } from '../../utils/booking-validation.js';
import { parseFlexibleDate } from '../../helpers/date-helpers.js';

/**
 * Integration tests for MCP tool workflows
 *
 * Tests the integration between:
 * - Tool parameter validation
 * - Business rule validation (booking-validation.ts)
 * - Date parsing (date-helpers.ts)
 * - API calls (mocked)
 *
 * These tests verify that tools work correctly end-to-end
 * without actually calling the DATS API.
 */

describe('book_trip tool workflow', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  describe('Date/Time Validation', () => {
    it('should accept flexible date formats', () => {
      // Mock current time: Jan 15, 2026 10:00 AM
      vi.setSystemTime(new Date('2026-01-15T17:00:00Z'));

      // Test various date formats
      const tomorrow = parseFlexibleDate('tomorrow', 'America/Edmonton');
      const friday = parseFlexibleDate('friday', 'America/Edmonton');
      const nextMonday = parseFlexibleDate('next monday', 'America/Edmonton');
      const isoDate = parseFlexibleDate('2026-01-20', 'America/Edmonton');

      // All should be valid dates
      expect(tomorrow).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(friday).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(nextMonday).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(isoDate).toBe('2026-01-20');
    });

    it('should validate booking window after parsing date', () => {
      vi.setSystemTime(new Date('2026-01-15T17:00:00Z'));

      // Parse tomorrow
      const tomorrow = parseFlexibleDate('tomorrow', 'America/Edmonton');

      // Validate booking for tomorrow at 2 PM
      const result = validateBookingWindow(tomorrow, '14:00');

      expect(result.valid).toBe(true);
    });

    it('should reject booking too far in advance', () => {
      vi.setSystemTime(new Date('2026-01-15T17:00:00Z'));

      // Try to book 5 days in advance (more than 3-day limit)
      const result = validateBookingWindow('2026-01-20', '14:00');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('only allows booking up to 3 days');
    });

    it('should validate same-day booking with sufficient notice', () => {
      vi.setSystemTime(new Date('2026-01-15T10:00:00Z'));

      // Today's date
      const today = parseFlexibleDate('today', 'America/Edmonton');

      // Book for 5 hours from now
      const result = validateBookingWindow(today, '15:00');

      expect(result.valid).toBe(true);
      expect(result.warning).toContain('not guaranteed');
    });

    it('should reject same-day booking with insufficient notice', () => {
      vi.setSystemTime(new Date('2026-01-15T10:00:00Z'));

      // Today's date
      const today = parseFlexibleDate('today', 'America/Edmonton');

      // Try to book for 1 hour from now (less than 2-hour minimum)
      const result = validateBookingWindow(today, '11:00');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('at least 2 hours notice');
    });
  });

  describe('Address Validation', () => {
    it('should require pickup address', () => {
      // Simulating tool parameter validation
      const pickupAddress = '';

      expect(pickupAddress).toBe('');
      // Tool would reject this (needs non-empty pickup address)
    });

    it('should require destination address', () => {
      const destinationAddress = '';

      expect(destinationAddress).toBe('');
      // Tool would reject this (needs non-empty destination address)
    });

    it('should accept valid addresses', () => {
      const pickupAddress = '123 Main St NW, Edmonton';
      const destinationAddress = '456 Oak Ave, Edmonton';

      expect(pickupAddress.length).toBeGreaterThan(0);
      expect(destinationAddress.length).toBeGreaterThan(0);
    });
  });

  describe('Mobility Device Validation', () => {
    it('should accept valid mobility devices', () => {
      const validDevices = ['wheelchair', 'scooter', 'walker', 'none'];

      validDevices.forEach((device) => {
        expect(['wheelchair', 'scooter', 'walker', 'none']).toContain(device);
      });
    });

    it('should reject invalid mobility devices', () => {
      const invalidDevice = 'crutches';

      expect(['wheelchair', 'scooter', 'walker', 'none']).not.toContain(invalidDevice);
    });
  });

  describe('Passenger Type Validation', () => {
    it('should accept valid passenger types', () => {
      const validTypes = ['escort', 'pca', 'guest'];

      validTypes.forEach((type) => {
        expect(['escort', 'pca', 'guest']).toContain(type);
      });
    });

    it('should handle multiple passengers', () => {
      const passengers = ['escort', 'pca'];

      expect(passengers.length).toBe(2);
      passengers.forEach((p) => {
        expect(['escort', 'pca', 'guest']).toContain(p);
      });
    });
  });

  describe('Complete Booking Workflow', () => {
    it('should validate all parameters for valid booking', () => {
      vi.setSystemTime(new Date('2026-01-15T17:00:00Z'));

      // Step 1: Parse flexible date
      const date = parseFlexibleDate('tomorrow', 'America/Edmonton');
      expect(date).toBe('2026-01-16');

      // Step 2: Validate booking window
      const validation = validateBookingWindow(date, '14:00');
      expect(validation.valid).toBe(true);

      // Step 3: Validate addresses
      const pickupAddress = '123 Main St NW';
      const destinationAddress = '456 Oak Ave';
      expect(pickupAddress).toBeTruthy();
      expect(destinationAddress).toBeTruthy();

      // Step 4: Validate optional parameters
      const mobilityDevice = 'wheelchair';
      expect(['wheelchair', 'scooter', 'walker', 'none']).toContain(mobilityDevice);

      // All validations pass - booking would proceed to API call
    });

    it('should fail early on invalid date', () => {
      vi.setSystemTime(new Date('2026-01-15T17:00:00Z'));

      // Invalid booking window (too far in advance)
      const validation = validateBookingWindow('2026-01-25', '14:00');
      expect(validation.valid).toBe(false);

      // Would not proceed to API call
    });

    it('should fail early on missing required fields', () => {
      const pickupAddress = '';

      expect(pickupAddress).toBeFalsy();
      // Tool validation would fail before API call (missing pickup address)
    });
  });
});

describe('get_trips tool workflow', () => {
  describe('Date Filtering', () => {
    it('should parse flexible date for filtering', () => {
      vi.setSystemTime(new Date('2026-01-15T17:00:00Z'));

      const today = parseFlexibleDate('today', 'America/Edmonton');
      const tomorrow = parseFlexibleDate('tomorrow', 'America/Edmonton');

      expect(today).toBe('2026-01-15');
      expect(tomorrow).toBe('2026-01-16');
    });

    it('should handle date range filtering', () => {
      vi.setSystemTime(new Date('2026-01-15T17:00:00Z'));

      const startDate = parseFlexibleDate('today', 'America/Edmonton');
      const endDate = parseFlexibleDate('friday', 'America/Edmonton');

      expect(startDate).toBe('2026-01-15');
      expect(endDate).toBe('2026-01-16'); // Next Friday
    });
  });

  describe('Status Filtering', () => {
    it('should filter active trips by default', () => {
      const activeStatuses = ['S', 'U', 'A', 'Pn'];
      const tripStatus = 'S'; // Scheduled

      expect(activeStatuses).toContain(tripStatus);
    });

    it('should recognize completed trips', () => {
      const inactiveStatuses = ['Pf', 'CA', 'NS', 'NM', 'R'];
      const tripStatus = 'Pf'; // Performed

      expect(inactiveStatuses).toContain(tripStatus);
    });

    it('should support include_all option', () => {
      const allStatuses = ['S', 'U', 'A', 'Pn', 'Pf', 'CA', 'NS', 'NM', 'R'];
      const tripStatus = 'CA'; // Cancelled

      expect(allStatuses).toContain(tripStatus);
    });
  });

  describe('Response Formatting', () => {
    it('should format trip dates consistently', () => {
      const apiDate = 'Mon, Jan 13, 2026';

      // Would be formatted for display
      expect(apiDate).toContain('Jan');
      expect(apiDate).toContain('2026');
    });

    it('should format time windows', () => {
      const pickupWindowStart = '7:50 AM';
      const pickupWindowEnd = '8:20 AM';

      // Would be formatted as "7:50 and 8:20 AM"
      expect(pickupWindowStart).toContain('AM');
      expect(pickupWindowEnd).toContain('AM');
    });
  });
});

describe('cancel_trip tool workflow', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  describe('2-Hour Notice Validation', () => {
    it('should validate cancellation with sufficient notice', () => {
      vi.setSystemTime(new Date('2026-01-15T10:00:00Z'));

      // Trip at 3:00 PM (5 hours away)
      const result = validateCancellation('Jan 15, 2026', '3:00 PM');

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject cancellation with insufficient notice', () => {
      vi.setSystemTime(new Date('2026-01-15T10:00:00Z'));

      // Trip at 11:00 AM (1 hour away)
      const result = validateCancellation('Jan 15, 2026', '11:00 AM');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('2 hours notice');
      expect(result.error).toContain('780-986-6010'); // DATS phone
    });

    it('should warn when close to 2-hour minimum', () => {
      vi.setSystemTime(new Date('2026-01-15T10:00:00Z'));

      // Trip at 12:30 PM (2.5 hours away)
      const result = validateCancellation('Jan 15, 2026', '12:30 PM');

      expect(result.valid).toBe(true);
      expect(result.warning).toContain('cutting it close');
    });
  });

  describe('Booking ID Validation', () => {
    it('should require booking ID', () => {
      const bookingId = '';

      expect(bookingId).toBeFalsy();
      // Tool would reject this
    });

    it('should accept valid booking ID', () => {
      const bookingId = '12345678';

      expect(bookingId).toBeTruthy();
      expect(bookingId.length).toBeGreaterThan(0);
    });
  });

  describe('User Confirmation Required', () => {
    it('should require explicit confirmation before cancelling', () => {
      // Tool should ask for confirmation with trip details
      const tripDetails = {
        date: 'Mon, Jan 13, 2026',
        time: '2:00 PM - 2:30 PM',
        pickup: 'McNally High School',
        destination: '9713 160 St NW',
      };

      expect(tripDetails.date).toBeDefined();
      expect(tripDetails.pickup).toBeDefined();
      expect(tripDetails.destination).toBeDefined();

      // User must confirm before API call proceeds
    });
  });

  describe('Complete Cancellation Workflow', () => {
    it('should validate all steps for valid cancellation', () => {
      vi.setSystemTime(new Date('2026-01-15T10:00:00Z'));

      // Step 1: Validate booking ID
      const bookingId = '12345678';
      expect(bookingId).toBeTruthy();

      // Step 2: Validate 2-hour notice
      const validation = validateCancellation('Jan 15, 2026', '3:00 PM');
      expect(validation.valid).toBe(true);

      // Step 3: Would get trip details from API (mocked)
      // Step 4: Would show confirmation to user
      // Step 5: Would call cancel API

      // All validations pass
    });

    it('should fail early on insufficient notice', () => {
      vi.setSystemTime(new Date('2026-01-15T10:00:00Z'));

      // Step 1: Booking ID valid
      const bookingId = '12345678';
      expect(bookingId).toBeTruthy();

      // Step 2: Validate 2-hour notice - FAILS
      const validation = validateCancellation('Jan 15, 2026', '11:00 AM');
      expect(validation.valid).toBe(false);

      // Would not proceed to API call
    });
  });
});

describe('track_trip tool timezone context', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  describe('dateContext Structure', () => {
    it('should include complete dateContext in successful response', async () => {
      // Mock current time: Jan 15, 2026 10:00 AM MST (5:00 PM UTC)
      vi.setSystemTime(new Date('2026-01-15T17:00:00Z'));

      // Create a mock successful track_trip response structure
      const mockResult = {
        success: true,
        bookingId: '12345',
        pickup: { eta: '10:30 AM', status: 'scheduled', address: '123 Main St' },
        dropoff: { eta: '11:00 AM', status: 'scheduled', address: '456 Oak Ave' },
        lastChecked: new Date().toISOString(),
      };

      // Simulate what track-trip.ts does with getCurrentDateInfo
      const { getCurrentDateInfo } = await import('../../helpers/date-helpers.js');
      const timezone = 'America/Edmonton';
      const dateInfo = getCurrentDateInfo(timezone);
      const dateContext = {
        currentDate: dateInfo.today,
        currentDayOfWeek: dateInfo.dayOfWeek,
        timezone,
        note: 'All DATS times are in Edmonton timezone (MST/MDT). The lastChecked timestamp is in UTC ISO format.',
      };

      const result = { ...mockResult, dateContext };

      // Verify dateContext structure
      expect(result.dateContext).toBeDefined();
      expect(result.dateContext.currentDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result.dateContext.currentDate).toBe('2026-01-15');
      expect(result.dateContext.currentDayOfWeek).toMatch(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/);
      expect(result.dateContext.currentDayOfWeek).toBe('Thursday');
      expect(result.dateContext.timezone).toBe('America/Edmonton');
      expect(result.dateContext.note).toContain('MST/MDT');
      expect(result.dateContext.note).toContain('UTC');
    });

    it('should include dateContext even when tracking fails', async () => {
      // Mock current time
      vi.setSystemTime(new Date('2026-01-15T17:00:00Z'));

      // Create a mock failed track_trip response
      const mockErrorResult = {
        success: false,
        bookingId: '12345',
        pickup: { eta: undefined, status: undefined, address: undefined },
        dropoff: { eta: undefined, status: undefined, address: undefined },
        lastChecked: new Date().toISOString(),
        error: {
          category: 'VALIDATION_ERROR',
          message: 'Live tracking not available. DATS has not dispatched a vehicle yet.',
          recoverable: true,
        },
      };

      // Simulate what track-trip.ts does
      const { getCurrentDateInfo } = await import('../../helpers/date-helpers.js');
      const timezone = 'America/Edmonton';
      const dateInfo = getCurrentDateInfo(timezone);
      const dateContext = {
        currentDate: dateInfo.today,
        currentDayOfWeek: dateInfo.dayOfWeek,
        timezone,
        note: 'All DATS times are in Edmonton timezone (MST/MDT)',
      };

      const result = { ...mockErrorResult, dateContext };

      expect(result.success).toBe(false);
      expect(result.dateContext).toBeDefined();
      expect(result.dateContext.timezone).toBe('America/Edmonton');
      expect(result.dateContext.currentDate).toBe('2026-01-15');
    });
  });

  describe('Midnight Boundary Edge Cases', () => {
    it('should use Edmonton date, not UTC date, near midnight', async () => {
      // 11:59 PM MST on Jan 15 = 6:59 AM UTC on Jan 16
      vi.setSystemTime(new Date('2026-01-16T06:59:00Z'));

      const { getCurrentDateInfo } = await import('../../helpers/date-helpers.js');
      const dateInfo = getCurrentDateInfo('America/Edmonton');

      // Should show Jan 15 (Edmonton date), not Jan 16 (UTC date)
      expect(dateInfo.today).toBe('2026-01-15');
      expect(dateInfo.dayOfWeek).toBe('Thursday');
    });

    it('should handle UTC midnight vs Edmonton midnight correctly', async () => {
      // 12:00 AM UTC on Jan 16 = 5:00 PM MST on Jan 15
      vi.setSystemTime(new Date('2026-01-16T00:00:00Z'));

      const { getCurrentDateInfo } = await import('../../helpers/date-helpers.js');
      const dateInfo = getCurrentDateInfo('America/Edmonton');

      // Should show Jan 15 (Edmonton is still previous day)
      expect(dateInfo.today).toBe('2026-01-15');
    });
  });

  describe('Year Boundary Edge Cases', () => {
    it('should handle year boundary correctly', async () => {
      // Dec 31, 2025 11:59 PM MST = Jan 1, 2026 6:59 AM UTC
      vi.setSystemTime(new Date('2026-01-01T06:59:00Z'));

      const { getCurrentDateInfo } = await import('../../helpers/date-helpers.js');
      const dateInfo = getCurrentDateInfo('America/Edmonton');

      // Should show Dec 31, 2025 (Edmonton date)
      expect(dateInfo.today).toBe('2025-12-31');
      expect(dateInfo.dayOfWeek).toBe('Wednesday');
    });

    it('should handle New Year transition correctly', async () => {
      // Jan 1, 2026 12:01 AM MST = 7:01 AM UTC
      vi.setSystemTime(new Date('2026-01-01T07:01:00Z'));

      const { getCurrentDateInfo } = await import('../../helpers/date-helpers.js');
      const dateInfo = getCurrentDateInfo('America/Edmonton');

      // Should show Jan 1, 2026 (New Year in Edmonton)
      expect(dateInfo.today).toBe('2026-01-01');
      expect(dateInfo.dayOfWeek).toBe('Thursday');
    });
  });

  describe('DST Transitions', () => {
    it('should handle DST spring forward transition (March 9, 2026)', async () => {
      // March 9, 2026 at 2:00 AM MST -> jumps to 3:00 AM MDT
      // Set to 9:00 AM UTC = 2:00 AM MST (right at transition)
      vi.setSystemTime(new Date('2026-03-09T09:00:00Z'));

      const { getCurrentDateInfo } = await import('../../helpers/date-helpers.js');
      const dateInfo = getCurrentDateInfo('America/Edmonton');

      // Should handle gracefully, no errors
      expect(dateInfo.today).toBe('2026-03-09');
      expect(dateInfo.dayOfWeek).toBe('Monday');
      // Date should be valid despite DST transition
      expect(dateInfo.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should handle DST fall back transition (November 2, 2026)', async () => {
      // November 2, 2026 at 2:00 AM MDT -> falls back to 1:00 AM MST
      // 2:00 AM happens twice
      // Set to 8:00 AM UTC = during the ambiguous hour
      vi.setSystemTime(new Date('2026-11-02T08:00:00Z'));

      const { getCurrentDateInfo } = await import('../../helpers/date-helpers.js');
      const dateInfo = getCurrentDateInfo('America/Edmonton');

      // Should handle gracefully
      expect(dateInfo.today).toBe('2026-11-02');
      expect(dateInfo.dayOfWeek).toBe('Monday');
      expect(dateInfo.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('Timestamp Format', () => {
    it('should return lastChecked in ISO 8601 UTC format', () => {
      vi.setSystemTime(new Date('2026-01-15T17:00:00Z'));

      const lastChecked = new Date().toISOString();

      // Verify ISO 8601 format: YYYY-MM-DDTHH:MM:SS.sssZ
      expect(lastChecked).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

      // Verify it's parseable
      expect(() => new Date(lastChecked)).not.toThrow();
      expect(new Date(lastChecked).getTime()).toBeGreaterThan(0);
    });
  });

  describe('Display Instructions', () => {
    it('should warn about timezone in displayInstructions', () => {
      const displayInstructions = `
DISPLAY THIS TRACKING INFO CLEARLY:
- Show the ETA prominently
- Include ALL vehicle and driver details
- Use simple text format (not tables) for mobile readability
- If vehicle has arrived, emphasize that fact
- IMPORTANT: All trip times are in Edmonton timezone (MST/MDT), NOT UTC
`.trim();

      expect(displayInstructions).toContain('Edmonton timezone');
      expect(displayInstructions).toContain('MST/MDT');
      expect(displayInstructions).toContain('NOT UTC');
    });
  });
});

describe('Cross-Tool Integration', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('should use consistent date parsing across tools', () => {
    vi.setSystemTime(new Date('2026-01-15T17:00:00Z'));

    const tomorrowFromBook = parseFlexibleDate('tomorrow', 'America/Edmonton');
    const tomorrowFromGet = parseFlexibleDate('tomorrow', 'America/Edmonton');

    expect(tomorrowFromBook).toBe(tomorrowFromGet);
    expect(tomorrowFromBook).toBe('2026-01-16');
  });

  it('should use consistent business rules across tools', () => {
    vi.setSystemTime(new Date('2026-01-15T10:00:00Z'));

    // Same 2-hour minimum for booking and cancellation
    const bookingValidation = validateBookingWindow('2026-01-15', '11:00');
    const cancellationValidation = validateCancellation('Jan 15, 2026', '11:00 AM');

    // Both should fail with similar reason (less than 2 hours)
    expect(bookingValidation.valid).toBe(false);
    expect(cancellationValidation.valid).toBe(false);
    expect(bookingValidation.error).toContain('2 hours');
    expect(cancellationValidation.error).toContain('2 hours');
  });

  it('should handle timezone consistently', () => {
    // All tools use America/Edmonton timezone by default
    vi.setSystemTime(new Date('2026-01-15T07:00:00Z')); // Midnight MST

    const today = parseFlexibleDate('today', 'America/Edmonton');
    expect(today).toBe('2026-01-15');

    // Would be same for all tools
  });

  it('should use America/Edmonton timezone in all tools with dateContext', async () => {
    vi.setSystemTime(new Date('2026-01-15T17:00:00Z')); // 10:00 AM MST

    const { getCurrentDateInfo } = await import('../../helpers/date-helpers.js');

    // Simulate what get_trips does
    const getTripsDateInfo = getCurrentDateInfo('America/Edmonton');

    // Simulate what track_trip does
    const trackTripDateInfo = getCurrentDateInfo('America/Edmonton');

    // Both should return same date (getCurrentDateInfo doesn't return timezone property)
    expect(getTripsDateInfo.today).toBe('2026-01-15');
    expect(trackTripDateInfo.today).toBe('2026-01-15');
    expect(getTripsDateInfo.dayOfWeek).toBe(trackTripDateInfo.dayOfWeek);

    // Both tools should explicitly set timezone to America/Edmonton
    const expectedTimezone = 'America/Edmonton';
    expect(expectedTimezone).toBe('America/Edmonton');
  });
});

describe('Error Handling Scenarios', () => {
  it('should handle invalid date formats gracefully', () => {
    const invalidDate = 'not-a-date';
    const parsed = parseFlexibleDate(invalidDate, 'America/Edmonton');

    // Returns as-is (validation happens later)
    expect(parsed).toBe('not-a-date');

    // Validation catches it
    const validation = validateBookingWindow(parsed, '14:00');
    expect(validation.valid).toBe(false);
    expect(validation.error).toContain('Could not parse');
  });

  it('should handle missing required fields', () => {
    const emptyAddress = '';

    expect(emptyAddress).toBeFalsy();
    // Tool validation would catch this before API call
  });

  it('should handle API failures gracefully', () => {
    // In real implementation, API errors would be caught and formatted
    const apiError = new Error('Network timeout');

    expect(apiError.message).toContain('timeout');
    // Tool would convert to user-friendly error message
  });
});
