import { defineConfig } from 'vitest/config';

// Node-environment unit tests for the worker processors. Prisma / storage / the
// OCR HTTP client are injected as fakes — no DB, no network, no queue in unit tests.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
