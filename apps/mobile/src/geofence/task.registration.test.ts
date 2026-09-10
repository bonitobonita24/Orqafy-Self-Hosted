// Proves the geofence background task REGISTERS at module scope WITHOUT a device
// (the wave done-bar), and drives the extracted pure handler through its branches.
//
// `expo-task-manager` and `./notifications` are the only native surfaces `./task`
// touches at import time; both are mocked so the module loads in vitest's node env.
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Spy for TaskManager.defineTask — capture the registered (name, executor).
// `vi.hoisted` so the spy exists before the hoisted `vi.mock` factory + the static
// `./task` import run (which call defineTask at module load).
const { defineTask } = vi.hoisted(() => ({ defineTask: vi.fn() }));
vi.mock('expo-task-manager', () => ({
  defineTask: (...args: unknown[]): void => {
    defineTask(...args);
  },
}));

// The native notification module is stubbed so importing `./task` resolves in node
// (it would otherwise pull `expo-notifications`). The module-scope task is wired to
// these real fns; the handler-behavior tests use the injectable factory instead.
vi.mock('./notifications', () => ({
  scheduleDwellNotification: vi.fn(),
  cancelDwellNotification: vi.fn(),
  configureNotifications: vi.fn(),
  ensureNotificationPermissions: vi.fn(),
}));

import { GEOFENCE_TASK } from './constants';
import { createGeofenceHandler, type GeofenceHandlerDeps, type GeofenceTaskData } from './task';

/** A `TaskManagerTaskBody`-shaped value built from possibly-malformed data (cast via
 *  `unknown`, never `any`, so the strict no-unsafe-* lint rules stay satisfied). */
function taskBody(
  data: unknown,
  error: { code: string; message: string } | null = null,
): Parameters<ReturnType<typeof createGeofenceHandler>>[0] {
  return {
    data,
    error,
    executionInfo: { eventId: 'e1', taskName: GEOFENCE_TASK },
  } as unknown as Parameters<ReturnType<typeof createGeofenceHandler>>[0];
}

describe('module-scope registration', () => {
  it('calls TaskManager.defineTask exactly once with GEOFENCE_TASK', () => {
    // `./task` was imported above (side-effect module); registration already ran.
    expect(defineTask).toHaveBeenCalledTimes(1);
    const call = defineTask.mock.calls[0]!;
    expect(call[0]).toBe(GEOFENCE_TASK);
    expect(typeof call[1]).toBe('function');
  });
});

describe('createGeofenceHandler', () => {
  const scheduleDwell = vi.fn<GeofenceHandlerDeps['scheduleDwell']>();
  const cancelDwell = vi.fn<GeofenceHandlerDeps['cancelDwell']>();
  let handler: ReturnType<typeof createGeofenceHandler>;

  beforeEach(() => {
    scheduleDwell.mockReset().mockResolvedValue(undefined);
    cancelDwell.mockReset().mockResolvedValue(undefined);
    handler = createGeofenceHandler({ scheduleDwell, cancelDwell });
  });

  const data = (eventType: number, identifier: string | undefined): GeofenceTaskData =>
    ({ eventType, region: identifier === undefined ? {} : { identifier } }) as GeofenceTaskData;

  it('on ENTER schedules a dwell notification with the region id and 180s delay', async () => {
    await handler(taskBody(data(1, 'task:9')));
    expect(scheduleDwell).toHaveBeenCalledTimes(1);
    const [id, delaySeconds, content] = scheduleDwell.mock.calls[0]!;
    expect(id).toBe('task:9');
    expect(delaySeconds).toBe(180); // DEFAULT_DWELL_MS (180000) / 1000
    expect(content.title.length).toBeGreaterThan(0);
    expect(cancelDwell).not.toHaveBeenCalled();
  });

  it('on EXIT cancels the dwell notification for the region id', async () => {
    await handler(taskBody(data(2, 'task:9')));
    expect(cancelDwell).toHaveBeenCalledTimes(1);
    expect(cancelDwell.mock.calls[0]![0]).toBe('task:9');
    expect(scheduleDwell).not.toHaveBeenCalled();
  });

  it('on error logs and does neither', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await handler(taskBody(data(1, 'task:9'), { code: 'ERR', message: 'boom' }));
    expect(warn).toHaveBeenCalledTimes(1);
    expect(scheduleDwell).not.toHaveBeenCalled();
    expect(cancelDwell).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('ignores an unknown event type', async () => {
    await handler(taskBody(data(0, 'task:9')));
    expect(scheduleDwell).not.toHaveBeenCalled();
    expect(cancelDwell).not.toHaveBeenCalled();
  });

  it('ignores a missing/empty region identifier', async () => {
    await handler(taskBody(data(1, '')));
    await handler(taskBody(data(1, undefined)));
    expect(scheduleDwell).not.toHaveBeenCalled();
  });
});
