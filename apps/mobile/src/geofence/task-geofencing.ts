// Task → geofence arming (chunk 5, security finding #3 carry).
//
// THE AUTHORIZATION BOUNDARY for on-device monitoring. `tasks.myTasks` is already
// assignee-filtered server-side (assigneeId === ctx.userId), so the device only ever
// sees the signed-in worker's own tasks. `selectArmableRegions` adds the second half of
// the boundary purely on-device: a region is monitored ONLY when the task actually has a
// site location AND "now" falls inside its active window. The net effect is that the OS
// never monitors a site the user is not assigned to, nor one outside the task's window —
// no location history is stored, presence-only (D-19).
//
// The module is split into a PURE selector (`selectArmableRegions`, unit-tested in plain
// Node) and a NATIVE hook (`useTaskGeofencing`, typecheck-only here — no device in CI).
import { useEffect } from 'react';

import * as Location from 'expo-location';

import { regionFromLocation, type GeofenceRegion } from '@orqafy/geofence';
import type { OrqafyApiClient } from '@orqafy/api-client';

import { armGeofences } from './arming';

/** An active-window bound as it may arrive from the wire (Date via superjson, or a raw
 * string/number/`null`). Revived to a `Date` before comparison. */
type ActiveBound = Date | string | number | null | undefined;

/** A geofence anchor: a site coordinate + its dwell radius. */
type GeoAnchor = { lat: number; lng: number; radiusMeters: number };

/** The strict shape the pure selector consumes (location already narrowed). */
export interface ArmableTask {
  id: string;
  title: string;
  project?: { name: string } | null;
  location?: GeoAnchor | null;
  geofenceActiveFrom?: ActiveBound;
  geofenceActiveUntil?: ActiveBound;
}

/** Revive any accepted bound form to a `Date`, or `null` for absent/unparseable. */
function reviveBound(value: ActiveBound): Date | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * The armable subset of `tasks` as OS-ready regions. A task is INCLUDED only when it has
 * a site location AND `now` is within `[geofenceActiveFrom, geofenceActiveUntil]` — a
 * null/absent bound leaves that side open. Pure + total: no I/O, safe in Node.
 */
export function selectArmableRegions(tasks: readonly ArmableTask[], now: Date): GeofenceRegion[] {
  const nowMs = now.getTime();
  const regions: GeofenceRegion[] = [];
  for (const task of tasks) {
    const location = task.location;
    if (location === null || location === undefined) continue; // no site → never monitor

    const from = reviveBound(task.geofenceActiveFrom);
    const until = reviveBound(task.geofenceActiveUntil);
    if (from !== null && nowMs < from.getTime()) continue; // window not open yet
    if (until !== null && nowMs > until.getTime()) continue; // window already closed

    const siteName = task.project?.name ?? task.title;
    regions.push(regionFromLocation(task.id, siteName, location));
  }
  return regions;
}

/** The loose task shape the hook accepts straight off `tasks.myTasks` (location is JSON,
 * hence `unknown` — narrowed by `coerceLocation`). */
export interface GeofenceTaskInput {
  id: string;
  title: string;
  project?: { name: string } | null;
  location?: unknown;
  geofenceActiveFrom?: ActiveBound;
  geofenceActiveUntil?: ActiveBound;
}

/** Narrow an untrusted JSON `location` to the geofence anchor, or `null` if malformed. */
function coerceLocation(value: unknown): GeoAnchor | null {
  if (value === null || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const { lat, lng, radiusMeters } = record;
  if (typeof lat === 'number' && typeof lng === 'number' && typeof radiusMeters === 'number') {
    return { lat, lng, radiusMeters };
  }
  return null;
}

function toArmableTasks(tasks: readonly GeofenceTaskInput[]): ArmableTask[] {
  return tasks.map((task) => ({
    id: task.id,
    title: task.title,
    project: task.project ?? null,
    location: coerceLocation(task.location),
    geofenceActiveFrom: task.geofenceActiveFrom,
    geofenceActiveUntil: task.geofenceActiveUntil,
  }));
}

/**
 * Native side-effect: (re)arm OS geofencing from the current task set. On every `tasks`
 * change it reads the device origin, computes the armable regions, and hands them to
 * `armGeofences` (which caps to the nearest 20 and REPLACES the monitored set). An empty
 * set tears monitoring down — `armGeofences([], origin)`'s documented behaviour. Every
 * native call is wrapped so nothing throws up into render. Typecheck-only in CI (no
 * device); `client` is accepted for call-site symmetry with the rest of the app.
 */
export function useTaskGeofencing(_client: OrqafyApiClient, tasks: readonly GeofenceTaskInput[]): void {
  useEffect(() => {
    void (async () => {
      try {
        const position = await Location.getCurrentPositionAsync({});
        const regions = selectArmableRegions(toArmableTasks(tasks), new Date());
        await armGeofences(regions, {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      } catch (err) {
        // No origin / native failure → do nothing this cycle rather than crash the screen.
        console.warn('[geofence] failed to arm task geofences', err);
      }
    })();
    // `tasks` is the trigger; `client` is intentionally not a dependency (its identity
    // change always coincides with a fresh `tasks` array from the new session).
  }, [tasks]);
}
