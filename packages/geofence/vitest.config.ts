import { defineConfig } from 'vitest/config';

// Node-environment unit tests for the pure geofence logic (no DOM, no timers —
// the dwell state machine is poll-driven so it stays deterministic).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
