/**
 * Tests for plain language formatting
 */

import { describe, it, expect } from 'vitest';
import {
  formatBookingConfirmation,
  formatCancellationConfirmation,
  formatTripsForUser,
  formatSingleTrip,
  formatTimeWindow,
  simplifyAddress,
  formatPassengerType,
  formatDatePlain,
  formatAvailabilityForUser,
} from '../../src/utils/plain-language.js';
import type { Trip, BookTripOutput } from '../../src/types.js';

describe('formatBookingConfirmation', () => {
  it('should format a successful booking', () => {
    const result: BookTripOutput = {
      success: true,
      confirmationNumber: '12345678',
      bookingId: '12345678',
      pickupWindow: { start: '2:00 PM', end: '2:30 PM' },
    };

    const message = formatBookingConfirmation(result);

    expect(message).toContain('trip is booked');
    expect(message).toContain('2:00');
    expect(message).toContain('2:30 PM');
    expect(message).toContain('12345678');
    expect(message).toContain('Save this number');
  });

  it('should format a failed booking', () => {
    const result: BookTripOutput = {
      success: false,
    };

    const message = formatBookingConfirmation(result);

    expect(message).toContain('could not book');
  });
});

describe('formatCancellationConfirmation', () => {
  it('should format a successful cancellation', () => {
    const message = formatCancellationConfirmation(true);

    expect(message).toContain('cancelled');
    expect(message).toContain('do not need');
  });

  it('should format a failed cancellation', () => {
    const message = formatCancellationConfirmation(false);

    expect(message).toContain('could not cancel');
    expect(message).toContain('780-986-6010');
  });
});

describe('formatTripsForUser', () => {
  it('should handle empty trips', () => {
    const message = formatTripsForUser([]);

    expect(message).toBe('You have no upcoming trips.');
  });

  it('should format single trip', () => {
    const trips: Trip[] = [
      {
        confirmationNumber: '12345678',
        bookingId: '12345678',
        date: '2026-01-12',
        pickupWindow: { start: '9:00 AM', end: '9:30 AM' },
        pickupAddress: 'Home, 123 Main St, Edmonton',
        destinationAddress: 'City Hall, 1 Churchill Square, Edmonton',
        status: 'confirmed',
      },
    ];

    const message = formatTripsForUser(trips);

    // Function now returns simple count + instruction for Claude to format
    expect(message).toContain('1 trip');
    expect(message).toContain('table');
  });

  it('should format multiple trips', () => {
    const trips: Trip[] = [
      {
        confirmationNumber: '11111111',
        bookingId: '11111111',
        date: '2026-01-12',
        pickupWindow: { start: '9:00 AM', end: '9:30 AM' },
        pickupAddress: 'Home',
        destinationAddress: 'Work',
        status: 'confirmed',
      },
      {
        confirmationNumber: '22222222',
        bookingId: '22222222',
        date: '2026-01-12',
        pickupWindow: { start: '5:00 PM', end: '5:30 PM' },
        pickupAddress: 'Work',
        destinationAddress: 'Home',
        status: 'confirmed',
      },
    ];

    const message = formatTripsForUser(trips);

    // Function now returns simple count + instruction for Claude to format
    expect(message).toContain('2 trips');
    expect(message).toContain('table');
  });
});

describe('formatSingleTrip', () => {
  it('should format trip with mobility device', () => {
    const trip: Trip = {
      confirmationNumber: '12345678',
      bookingId: '12345678',
      date: '2026-01-12',
      pickupWindow: { start: '9:00 AM', end: '9:30 AM' },
      pickupAddress: 'Home',
      destinationAddress: 'Hospital',
      status: 'confirmed',
      mobilityDevice: 'Wheelchair',
    };

    const formatted = formatSingleTrip(trip);

    expect(formatted).toContain('wheelchair');
    expect(formatted).toContain('Home');
    expect(formatted).toContain('Hospital');
  });

  it('should format trip with passengers', () => {
    const trip: Trip = {
      confirmationNumber: '12345678',
      bookingId: '12345678',
      date: '2026-01-12',
      pickupWindow: { start: '9:00 AM', end: '9:30 AM' },
      pickupAddress: 'Home',
      destinationAddress: 'Hospital',
      status: 'confirmed',
      additionalPassengers: [{ type: 'escort', count: 1 }],
    };

    const formatted = formatSingleTrip(trip);

    expect(formatted).toContain('companion'); // escort -> companion
  });
});

describe('formatTimeWindow', () => {
  it('should combine same period (AM/PM)', () => {
    const window = { start: '9:00 AM', end: '9:30 AM' };
    const formatted = formatTimeWindow(window);

    // Should show "9:00 and 9:30 AM" (period only once)
    expect(formatted).toBe('9:00 and 9:30 AM');
  });

  it('should keep different periods', () => {
    const window = { start: '11:30 AM', end: '12:00 PM' };
    const formatted = formatTimeWindow(window);

    expect(formatted).toContain('11:30 AM');
    expect(formatted).toContain('12:00 PM');
  });
});

describe('simplifyAddress', () => {
  it('should extract named location', () => {
    expect(simplifyAddress('Home, 123 Main St, Edmonton')).toBe('Home');
    expect(simplifyAddress('City Hall, 1 Churchill Square')).toBe('City Hall');
  });

  it('should use street address if no name', () => {
    expect(simplifyAddress('123 Main St, Edmonton, AB')).toBe('123 Main St, Edmonton');
  });

  it('should handle unknown addresses', () => {
    expect(simplifyAddress('')).toBe('your location');
    expect(simplifyAddress('Unknown address')).toBe('your location');
  });
});

describe('formatPassengerType', () => {
  it('should use plain language for passenger types', () => {
    expect(formatPassengerType('escort')).toBe('companion');
    expect(formatPassengerType('pca')).toBe('care helper');
    expect(formatPassengerType('guest')).toBe('guest');
  });
});

describe('formatDatePlain', () => {
  it('should format YYYY-MM-DD', () => {
    const formatted = formatDatePlain('2026-01-12');
    expect(formatted).toContain('Monday');
    expect(formatted).toContain('January');
    expect(formatted).toContain('12');
  });

  it('should format YYYYMMDD', () => {
    const formatted = formatDatePlain('20260112');
    expect(formatted).toContain('Monday');
    expect(formatted).toContain('January');
  });

  it('should handle already formatted dates', () => {
    const formatted = formatDatePlain('Jan 12, 2026');
    expect(formatted).toContain('January');
    expect(formatted).toContain('12');
  });
});

describe('formatAvailabilityForUser', () => {
  it('should handle no available dates', () => {
    const message = formatAvailabilityForUser([]);
    expect(message).toContain('no dates available');
  });

  it('should format list of available dates', () => {
    const dates = ['Jan 12, 2026', 'Jan 13, 2026', 'Jan 14, 2026'];
    const message = formatAvailabilityForUser(dates);

    expect(message).toContain('book trips on these dates');
    expect(message).toContain('January');
  });

  it('should format specific date with time window', () => {
    const dates = ['Jan 12, 2026', 'Jan 13, 2026'];
    const timeWindow = { earliest: '6:00 AM', latest: '11:00 PM' };
    const message = formatAvailabilityForUser(dates, timeWindow, '2026-01-12');

    expect(message).toContain('6:00 AM');
    expect(message).toContain('11:00 PM');
    expect(message).toContain('Monday, January 12');
    expect(message).toContain('Other available dates');
  });

  it('should include help text', () => {
    const dates = ['Jan 12, 2026'];
    const message = formatAvailabilityForUser(dates);

    expect(message).toContain('check times');
  });
});
