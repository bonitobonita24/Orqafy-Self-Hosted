// Proves session teardown actually disarms the device.
//
// Regression guard for a real defect: `signOut` used to clear only the token, leaving
// the OS monitoring the previous user's regions and any armed dwell timer live — so a
// signed-out device kept raising "you've arrived on site" alerts. `teardownGeofencing`
// must stop geofencing AND drop pending dwell notifications, and must never throw.
//
// `expo-location` and `./notifications` are the native surfaces `./arming` touches;
// both are mocked so the module loads in vitest's node env. `./task` is stubbed because
// `./arming` side-effect-imports it (module-scope defineTask).
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { hasStarted, stopGeofencing, cancelAll } = vi.hoisted(() => ({
  hasStarted: vi.fn(),
  stopGeofencing: vi.fn(),
  cancelAll: vi.fn(),
}));

vi.mock('expo-location', () => ({
  hasStartedGeofencingAsync: (...a: unknown[]): unknown => hasStarted(...a),
  stopGeofencingAsync: (...a: unknown[]): unknown => stopGeofencing(...a),
  startGeofencingAsync: vi.fn(),
  requestForegroundPermissionsAsync: vi.fn(),
  requestBackgroundPermissionsAsync: vi.fn(),
}));

vi.mock('./notifications', () => ({
  cancelAllDwellNotifications: (...a: unknown[]): unknown => cancelAll(...a),
  configureNotifications: vi.fn(),
  ensureNotificationPermissions: vi.fn(),
  scheduleDwellNotification: vi.fn(),
  cancelDwellNotification: vi.fn(),
}));

// `./arming` imports `./task` for its module-scope defineTask side-effect.
vi.mock('./task', () => ({}));

import { GEOFENCE_TASK } from './constants';
import { teardownGeofencing } from './arming';

describe('teardownGeofencing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hasStarted.mockResolvedValue(true);
    stopGeofencing.mockResolvedValue(undefined);
    cancelAll.mockResolvedValue(undefined);
  });

  it('stops geofencing and cancels pending dwell notifications', async () => {
    await teardownGeofencing();

    expect(stopGeofencing).toHaveBeenCalledTimes(1);
    expect(stopGeofencing).toHaveBeenCalledWith(GEOFENCE_TASK);
    expect(cancelAll).toHaveBeenCalledTimes(1);
  });

  it('skips stopGeofencing when nothing is armed, but still cancels dwell timers', async () => {
    hasStarted.mockResolvedValue(false);

    await teardownGeofencing();

    expect(stopGeofencing).not.toHaveBeenCalled();
    expect(cancelAll).toHaveBeenCalledTimes(1);
  });

  it('still cancels dwell timers when stopping geofencing fails (never throws)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    stopGeofencing.mockRejectedValue(new Error('native down'));

    await expect(teardownGeofencing()).resolves.toBeUndefined();

    // The failure must not short-circuit the notification cleanup — a pending dwell
    // alert firing after sign-out is the exact leak this guards.
    expect(cancelAll).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
