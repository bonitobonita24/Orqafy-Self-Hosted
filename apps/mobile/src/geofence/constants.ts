// Geofence wiring constants (chunk 4). Pure module — no native imports, so it is
// safe to import from both the native task/arming modules and from vitest.

/**
 * Task name registered with `expo-task-manager` / `startGeofencingAsync`. The
 * SAME string must be used for `defineTask`, `startGeofencingAsync`,
 * `stopGeofencingAsync`, and `hasStartedGeofencingAsync` — it is the handle that
 * ties the OS geofencing subsystem to our background task.
 */
export const GEOFENCE_TASK = 'orqafy.geofence';

/**
 * Deterministic scheduled-notification identifier for a region's app-side dwell
 * timer. Keyed by the region identifier so an ENTER can schedule exactly one
 * dwell notification and a later EXIT can cancel that same one — guaranteeing a
 * single source of a fired dwell alert (no double-fire).
 */
export function dwellNotificationId(regionIdentifier: string): string {
  return `dwell:${regionIdentifier}`;
}
