import { defineConfig } from 'vitest/config';

// Node-environment unit tests for the pure storage helpers (key derivation).
// No DOM, no network — the adapters themselves are integration-tested elsewhere.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
