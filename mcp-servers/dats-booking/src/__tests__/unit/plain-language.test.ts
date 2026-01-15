import { describe, it, expect } from 'vitest';
import { formatTimeWindow, simplifyAddress, formatPassengerType } from '../../utils/plain-language.js';
import type { PickupWindow } from '../../types.js';

describe('formatTimeWindow', () => {
  it('should format time window with same period (AM)', () => {
    const window: PickupWindow = { start: '10:00 AM', end: '10:30 AM' };
    const result = formatTimeWindow(window);
    expect(result).toBe('10:00 and 10:30 AM');
  });

  it('should format time window with same period (PM)', () => {
    const window: PickupWindow = { start: '2:00 PM', end: '2:30 PM' };
    const result = formatTimeWindow(window);
    expect(result).toBe('2:00 and 2:30 PM');
  });

  it('should format time window with different periods', () => {
    const window: PickupWindow = { start: '11:30 AM', end: '12:00 PM' };
    const result = formatTimeWindow(window);
    expect(result).toBe('11:30 AM and 12:00 PM');
  });

  it('should handle missing start time', () => {
    const window: PickupWindow = { start: '', end: '2:30 PM' };
    const result = formatTimeWindow(window);
    expect(result).toBe('the scheduled time');
  });

  it('should handle missing end time', () => {
    const window: PickupWindow = { start: '2:00 PM', end: '' };
    const result = formatTimeWindow(window);
    expect(result).toBe('the scheduled time');
  });
});

describe('simplifyAddress', () => {
  it('should return name for named locations', () => {
    const address = 'Home, 123 Main St, Edmonton, AB';
    const result = simplifyAddress(address);
    expect(result).toBe('Home');
  });

  it('should return street address for numbered locations', () => {
    const address = '123 Main St, Edmonton, AB, T5N 1A1';
    const result = simplifyAddress(address);
    expect(result).toBe('123 Main St, Edmonton');
  });

  it('should handle unknown address', () => {
    const result = simplifyAddress('Unknown address');
    expect(result).toBe('your location');
  });

  it('should handle empty address', () => {
    const result = simplifyAddress('');
    expect(result).toBe('your location');
  });
});

describe('formatPassengerType', () => {
  it('should format escort as companion', () => {
    expect(formatPassengerType('escort')).toBe('companion');
  });

  it('should format pca as care helper', () => {
    expect(formatPassengerType('pca')).toBe('care helper');
  });

  it('should format guest as guest', () => {
    expect(formatPassengerType('guest')).toBe('guest');
  });
});
