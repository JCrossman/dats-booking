import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  validateBookingRequest,
  validateCancellation,
} from '../../src/utils/validation.js';

describe('validateBookingRequest', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-10T10:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should reject bookings more than 3 days ahead', () => {
    const error = validateBookingRequest({
      pickupDate: '2026-01-15',
      pickupTime: '14:00',
      pickupAddress: '123 Test St',
      destinationAddress: '456 Dest Ave',
    });

    expect(error).toContain('3 days in advance');
  });

  it('should reject same-day bookings with less than 2 hours notice', () => {
    const error = validateBookingRequest({
      pickupDate: '2026-01-10',
      pickupTime: '11:00',
      pickupAddress: '123 Test St',
      destinationAddress: '456 Dest Ave',
    });

    expect(error).toContain('2 hours notice');
  });

  it('should reject next-day bookings after noon', () => {
    vi.setSystemTime(new Date('2026-01-10T14:00:00'));

    const error = validateBookingRequest({
      pickupDate: '2026-01-11',
      pickupTime: '10:00',
      pickupAddress: '123 Test St',
      destinationAddress: '456 Dest Ave',
    });

    expect(error).toContain('before noon');
  });

  it('should accept valid booking within 3 days', () => {
    const error = validateBookingRequest({
      pickupDate: '2026-01-12',
      pickupTime: '14:00',
      pickupAddress: '123 Test St',
      destinationAddress: '456 Dest Ave',
    });

    expect(error).toBeNull();
  });

  it('should reject past dates', () => {
    const error = validateBookingRequest({
      pickupDate: '2026-01-09',
      pickupTime: '14:00',
      pickupAddress: '123 Test St',
      destinationAddress: '456 Dest Ave',
    });

    expect(error).toContain('past');
  });

  it('should reject invalid date format', () => {
    const error = validateBookingRequest({
      pickupDate: '01-10-2026',
      pickupTime: '14:00',
      pickupAddress: '123 Test St',
      destinationAddress: '456 Dest Ave',
    });

    expect(error).toContain('Invalid date format');
  });

  it('should reject invalid time format', () => {
    const error = validateBookingRequest({
      pickupDate: '2026-01-12',
      pickupTime: '2:00 PM',
      pickupAddress: '123 Test St',
      destinationAddress: '456 Dest Ave',
    });

    expect(error).toContain('Invalid time format');
  });

  it('should accept same-day booking with more than 2 hours notice', () => {
    const error = validateBookingRequest({
      pickupDate: '2026-01-10',
      pickupTime: '14:00',
      pickupAddress: '123 Test St',
      destinationAddress: '456 Dest Ave',
    });

    expect(error).toBeNull();
  });

  it('should accept next-day booking before noon', () => {
    vi.setSystemTime(new Date('2026-01-10T09:00:00'));

    const error = validateBookingRequest({
      pickupDate: '2026-01-11',
      pickupTime: '10:00',
      pickupAddress: '123 Test St',
      destinationAddress: '456 Dest Ave',
    });

    expect(error).toBeNull();
  });
});

describe('validateCancellation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-10T10:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should reject cancellation with less than 2 hours notice', () => {
    const pickupTime = new Date('2026-01-10T11:30:00');
    const error = validateCancellation(pickupTime);

    expect(error).toContain('2 hours notice');
  });

  it('should accept cancellation with more than 2 hours notice', () => {
    const pickupTime = new Date('2026-01-10T14:00:00');
    const error = validateCancellation(pickupTime);

    expect(error).toBeNull();
  });

  it('should accept cancellation exactly at 2 hours', () => {
    const pickupTime = new Date('2026-01-10T12:00:00');
    const error = validateCancellation(pickupTime);

    expect(error).toBeNull();
  });
});
