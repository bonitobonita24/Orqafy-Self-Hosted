import { defineConfig } from 'vitest/config';

// Node-environment unit tests for the pure shared helpers (no DOM, no timers).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
