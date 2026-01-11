import { describe, it, expect, beforeEach } from 'vitest';
import { RateLimiter } from '../../src/automation/rate-limiter.js';

describe('RateLimiter', () => {
  beforeEach(() => {
    process.env.DATS_RATE_LIMIT_MS = '50';
  });

  it('should enforce minimum delay between requests', async () => {
    const limiter = new RateLimiter(100);

    const start = Date.now();

    await limiter.execute(async () => 'first');
    await limiter.execute(async () => 'second');

    const elapsed = Date.now() - start;

    expect(elapsed).toBeGreaterThanOrEqual(100);
  });

  it('should return operation result', async () => {
    const limiter = new RateLimiter(10);

    const result = await limiter.execute(async () => 'test-result');

    expect(result).toBe('test-result');
  });

  it('should use default rate limit from env', () => {
    process.env.DATS_RATE_LIMIT_MS = '5000';
    const limiter = new RateLimiter();

    expect(limiter.getRateLimitMs()).toBe(5000);
  });

  it('should not delay if enough time has passed', async () => {
    const limiter = new RateLimiter(10);

    await limiter.execute(async () => 'first');

    await new Promise((resolve) => setTimeout(resolve, 20));

    const start = Date.now();
    await limiter.execute(async () => 'second');
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(10);
  });

  it('should handle async operations correctly', async () => {
    const limiter = new RateLimiter(10);
    const results: number[] = [];

    await limiter.execute(async () => {
      results.push(1);
    });
    await limiter.execute(async () => {
      results.push(2);
    });
    await limiter.execute(async () => {
      results.push(3);
    });

    expect(results).toEqual([1, 2, 3]);
  });
});
