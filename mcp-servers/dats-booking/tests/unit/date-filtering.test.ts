import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Tests for date filtering and normalization logic used in get_trips
 *
 * The normalizeTripDate function converts various date formats to YYYY-MM-DD
 * for comparison when filtering trips by date.
 */

// Import the functions we need to test by recreating them here
// (These are private functions in index.ts, so we test the logic directly)

function normalizeTripDate(dateStr: string): string {
  // If already in YYYY-MM-DD format, return as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }

  // Handle "Tue, Jan 13, 2026" format
  const monthNames: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  };

  // Try to parse "Day, Mon DD, YYYY" format
  const match = dateStr.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (match) {
    const monthStr = match[1].toLowerCase().substring(0, 3);
    const month = monthNames[monthStr];
    const day = match[2].padStart(2, '0');
    const year = match[3];

    if (month) {
      return `${year}-${month}-${day}`;
    }
  }

  // Fallback: return empty string (won't match any date)
  return '';
}

describe('normalizeTripDate', () => {
  it('should return YYYY-MM-DD format unchanged', () => {
    expect(normalizeTripDate('2026-01-13')).toBe('2026-01-13');
    expect(normalizeTripDate('2026-12-25')).toBe('2026-12-25');
  });

  it('should parse "Tue, Jan 13, 2026" format', () => {
    expect(normalizeTripDate('Tue, Jan 13, 2026')).toBe('2026-01-13');
    expect(normalizeTripDate('Mon, Dec 25, 2026')).toBe('2026-12-25');
    expect(normalizeTripDate('Wed, Feb 5, 2026')).toBe('2026-02-05');
  });

  it('should handle single-digit days', () => {
    expect(normalizeTripDate('Mon, Jan 5, 2026')).toBe('2026-01-05');
    expect(normalizeTripDate('Tue, Feb 1, 2026')).toBe('2026-02-01');
  });

  it('should handle all months', () => {
    expect(normalizeTripDate('Mon, January 1, 2026')).toBe('2026-01-01');
    expect(normalizeTripDate('Tue, February 1, 2026')).toBe('2026-02-01');
    expect(normalizeTripDate('Wed, March 1, 2026')).toBe('2026-03-01');
    expect(normalizeTripDate('Thu, April 1, 2026')).toBe('2026-04-01');
    expect(normalizeTripDate('Fri, May 1, 2026')).toBe('2026-05-01');
    expect(normalizeTripDate('Sat, June 1, 2026')).toBe('2026-06-01');
    expect(normalizeTripDate('Sun, July 1, 2026')).toBe('2026-07-01');
    expect(normalizeTripDate('Mon, August 1, 2026')).toBe('2026-08-01');
    expect(normalizeTripDate('Tue, September 1, 2026')).toBe('2026-09-01');
    expect(normalizeTripDate('Wed, October 1, 2026')).toBe('2026-10-01');
    expect(normalizeTripDate('Thu, November 1, 2026')).toBe('2026-11-01');
    expect(normalizeTripDate('Fri, December 1, 2026')).toBe('2026-12-01');
  });

  it('should return empty string for unrecognized formats', () => {
    expect(normalizeTripDate('invalid date')).toBe('');
    expect(normalizeTripDate('')).toBe('');
    expect(normalizeTripDate('13/01/2026')).toBe('');
  });
});

describe('trip filtering logic', () => {
  const TRIP_STATUSES: Record<string, { isActive: boolean }> = {
    S: { isActive: true },   // Scheduled
    U: { isActive: true },   // Unscheduled
    A: { isActive: true },   // Arrived
    Pn: { isActive: true },  // Pending
    Pf: { isActive: false }, // Performed (completed)
    CA: { isActive: false }, // Cancelled
    NS: { isActive: false }, // No Show
    NM: { isActive: false }, // Missed Trip
    R: { isActive: false },  // Refused
  };

  // Helper to simulate the filtering logic from index.ts
  function filterTrips(
    trips: Array<{ date: string; status: string }>,
    todayStr: string,
    includeAll: boolean,
    statusFilter?: string[]
  ): Array<{ date: string; status: string }> {
    if (statusFilter && statusFilter.length > 0) {
      return trips.filter(trip => statusFilter.includes(trip.status));
    } else if (!includeAll) {
      return trips.filter(trip => {
        const tripDateNormalized = normalizeTripDate(trip.date);
        const isToday = tripDateNormalized === todayStr;

        if (isToday) {
          return true;
        }

        const statusInfo = TRIP_STATUSES[trip.status];
        return statusInfo?.isActive ?? false;
      });
    }
    return trips;
  }

  it('should include completed trips for today by default', () => {
    const today = '2026-01-13';
    const trips = [
      { date: 'Tue, Jan 13, 2026', status: 'Pf' },  // Completed today
      { date: 'Tue, Jan 13, 2026', status: 'S' },   // Scheduled today
    ];

    const result = filterTrips(trips, today, false);

    expect(result).toHaveLength(2);
    expect(result.some(t => t.status === 'Pf')).toBe(true);
    expect(result.some(t => t.status === 'S')).toBe(true);
  });

  it('should include cancelled trips for today by default', () => {
    const today = '2026-01-13';
    const trips = [
      { date: 'Tue, Jan 13, 2026', status: 'CA' },  // Cancelled today
      { date: 'Tue, Jan 13, 2026', status: 'S' },   // Scheduled today
    ];

    const result = filterTrips(trips, today, false);

    expect(result).toHaveLength(2);
    expect(result.some(t => t.status === 'CA')).toBe(true);
  });

  it('should exclude completed trips from future dates by default', () => {
    const today = '2026-01-13';
    const trips = [
      { date: 'Wed, Jan 14, 2026', status: 'Pf' },  // Completed tomorrow (shouldn't happen but test edge case)
      { date: 'Wed, Jan 14, 2026', status: 'S' },   // Scheduled tomorrow
    ];

    const result = filterTrips(trips, today, false);

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('S');
  });

  it('should include all trips when include_all is true', () => {
    const today = '2026-01-13';
    const trips = [
      { date: 'Mon, Jan 12, 2026', status: 'Pf' },  // Completed yesterday
      { date: 'Tue, Jan 13, 2026', status: 'Pf' },  // Completed today
      { date: 'Wed, Jan 14, 2026', status: 'S' },   // Scheduled tomorrow
      { date: 'Wed, Jan 14, 2026', status: 'CA' },  // Cancelled tomorrow
    ];

    const result = filterTrips(trips, today, true);

    expect(result).toHaveLength(4);
  });

  it('should filter to specific status when status_filter is provided', () => {
    const today = '2026-01-13';
    const trips = [
      { date: 'Mon, Jan 12, 2026', status: 'Pf' },
      { date: 'Tue, Jan 13, 2026', status: 'S' },
      { date: 'Wed, Jan 14, 2026', status: 'Pf' },
    ];

    const result = filterTrips(trips, today, false, ['Pf']);

    expect(result).toHaveLength(2);
    expect(result.every(t => t.status === 'Pf')).toBe(true);
  });

  it('should handle no-show status for today', () => {
    const today = '2026-01-13';
    const trips = [
      { date: 'Tue, Jan 13, 2026', status: 'NS' },  // No-show today
    ];

    const result = filterTrips(trips, today, false);

    expect(result).toHaveLength(1);
  });
});
