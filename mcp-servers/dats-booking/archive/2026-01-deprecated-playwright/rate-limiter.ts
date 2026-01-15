/**
 * Rate Limiter for DATS Portal Requests
 *
 * Ensures minimum 3-second delay between DATS requests
 */

const DEFAULT_RATE_LIMIT_MS = 3000;

export class RateLimiter {
  private lastRequestTime = 0;
  private readonly minDelayMs: number;

  constructor(minDelayMs?: number) {
    this.minDelayMs =
      minDelayMs ??
      parseInt(process.env.DATS_RATE_LIMIT_MS ?? String(DEFAULT_RATE_LIMIT_MS), 10);
  }

  /**
   * Wait if necessary to respect rate limit
   */
  async waitForNextRequest(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    const waitTime = Math.max(0, this.minDelayMs - elapsed);

    if (waitTime > 0) {
      await this.delay(waitTime);
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Wrap an async operation with rate limiting
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    await this.waitForNextRequest();
    return operation();
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get the configured rate limit in milliseconds
   */
  getRateLimitMs(): number {
    return this.minDelayMs;
  }
}
