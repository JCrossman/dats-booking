/**
 * Vitest test setup
 */

import { beforeAll, afterAll } from 'vitest';

beforeAll(() => {
  // Set up test environment variables
  process.env.DATS_ENCRYPTION_KEY = 'test-encryption-key-minimum-32-chars!!';
  process.env.LOG_LEVEL = 'error'; // Quiet logs during tests
  process.env.DATS_RATE_LIMIT_MS = '10'; // Fast rate limiting for tests
});

afterAll(() => {
  // Cleanup
});
