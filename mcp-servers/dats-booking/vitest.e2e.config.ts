import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/e2e/**/*.test.ts'],
    testTimeout: 60000, // E2E tests may take longer
    hookTimeout: 30000,
  },
});
