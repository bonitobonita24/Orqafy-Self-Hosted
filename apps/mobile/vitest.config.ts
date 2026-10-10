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
    // Vitest 5 defaults `clearMocks` to true (vi.clearAllMocks() before every
    // test), which wipes mock-call history recorded at MODULE-SCOPE import time
    // — exactly task.registration.test.ts's "module-scope registration" case
    // (expo-task-manager.defineTask is called when `./task` is imported, before
    // any test runs). Restore the pre-v5 behavior so that assertion still holds.
    // https://vitest.dev/guide/migration/#clearmocks-is-enabled-by-default
    clearMocks: false,
  },
});
