// Background geofencing task registration (chunk 4).
//
// `expo-task-manager` requires the task to be defined in the GLOBAL scope of the JS
// bundle — when the app is launched in the background for a geofence event, RN spins
// up, runs this task, and shuts down (no React tree mounts). So `defineTask` is
// called at MODULE TOP-LEVEL here; `arming.ts` (and the app root) `import './task'`
// purely for that side-effect.
//
// The handler logic is extracted into `createGeofenceHandler(deps)` so it is unit-
// testable with injected notification fns (no device, no native mocks needed for the
// behavior tests); module scope wires the real notification fns into it.
import * as TaskManager from 'expo-task-manager';
import { DEFAULT_DWELL_MS } from '@orqafy/geofence';
import type { LocationGeofencingEventType, LocationRegion } from 'expo-location';

import { arrivalNotificationContent, mapEventType } from './adapter';
import { GEOFENCE_TASK } from './constants';
import { cancelDwellNotification, scheduleDwellNotification } from './notifications';

export { GEOFENCE_TASK } from './constants';

/** Data payload the OS delivers to the geofencing task on each ENTER/EXIT. */
export interface GeofenceTaskData {
  eventType: LocationGeofencingEventType;
  region: LocationRegion;
}

/** Injectable notification side-effects — real in the app, mocked in tests. */
export interface GeofenceHandlerDeps {
  scheduleDwell: (
    regionIdentifier: string,
    delaySeconds: number,
    content: { title: string; body: string },
  ) => Promise<void>;
  cancelDwell: (regionIdentifier: string) => Promise<void>;
}

/**
 * Build the geofencing task executor. On native ENTER it schedules the single dwell
 * notification (180s per `DEFAULT_DWELL_MS`); on native EXIT it cancels it. Defensive:
 * a task error, an unrecognised event type, or a missing region id short-circuits
 * with no side-effect.
 */
export function createGeofenceHandler(
  deps: GeofenceHandlerDeps,
): TaskManager.TaskManagerTaskExecutor<GeofenceTaskData> {
  return async ({ data, error }) => {
    if (error) {
      console.warn('[geofence] task error', error);
      return;
    }
    const { eventType, region } = data;
    const kind = mapEventType(eventType);
    if (kind === null) return;

    const id = region?.identifier ?? '';
    if (id === '') return;

    if (kind === 'enter') {
      await deps.scheduleDwell(id, DEFAULT_DWELL_MS / 1000, arrivalNotificationContent(id));
    } else {
      await deps.cancelDwell(id);
    }
  };
}

// Module-scope registration — the whole point of this file. Wires the real native
// notification fns into the pure handler.
TaskManager.defineTask<GeofenceTaskData>(
  GEOFENCE_TASK,
  createGeofenceHandler({
    scheduleDwell: scheduleDwellNotification,
    cancelDwell: cancelDwellNotification,
  }),
);
