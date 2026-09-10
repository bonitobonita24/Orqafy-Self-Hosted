import { defineConfig } from 'vitest/config';

// Node-environment unit tests for the PURE offline logic (outbox/reconcile/
// sync-engine). The expo-sqlite adapter under src/offline/sqlite/** is
// typecheck-only and excluded belt-and-braces so vitest never tries to resolve
// `expo-sqlite` (the pure tests import only pure modules, so it wouldn't anyway).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['src/offline/sqlite/**', 'node_modules/**'],
  },
});
