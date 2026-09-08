// Region model + the on-device region-state enum.
//
// Source of truth for the geofence data shape shared by the Expo native app
// (which arms the OS geofencing subsystem) and any server-side reasoning about
// the same regions. Presence-only per D-19: a region carries WHERE a site is
// and WHICH task it belongs to — never a worker's location history.
//
// The `RegionState` values mirror Expo's `GeofencingRegionState`
// (docs/planning/R6_EXPO_GEOFENCING.md §2): Unknown=0 / Inside=1 / Outside=2,
// so a value coming off the native bridge maps 1:1 onto this enum.

import type { Location } from '@orqafy/shared';

/**
 * On-device region state. Numeric values are pinned to Expo's
 * `GeofencingRegionState` so native events need no translation table.
 */
export enum RegionState {
  Unknown = 0,
  Inside = 1,
  Outside = 2,
}

/**
 * A monitored geofence region: a site task's coordinate anchor + dwell radius,
 * plus the identifiers needed to route a fired alert back to its task.
 *
 * `identifier` is the stable string handed to `startGeofencingAsync` and echoed
 * back on the native Enter/Exit event, so it must be unique within an armed set.
 */
export interface GeofenceRegion {
  /** Stable identifier used by the OS geofencing task (unique per armed set). */
  identifier: string;
  /** The Task this region belongs to (PRODUCT Task.location — D-19). */
  taskId: string;
  /** Human label for the site, shown on the "you're on site" sheet. */
  siteName: string;
  /** WGS84 latitude. */
  lat: number;
  /** WGS84 longitude. */
  lng: number;
  /** Dwell/trigger radius in metres. */
  radiusMeters: number;
}

/** A plain lat/lng reading used for distance + inside/outside evaluation. */
export interface GeoPoint {
  lat: number;
  lng: number;
}

/**
 * Build a `GeofenceRegion` from a Task id/name + a shared `Location` value
 * object (the schema in `@orqafy/shared`). Keeps the two representations in one
 * place so the app never hand-rolls the mapping.
 */
export function regionFromLocation(
  taskId: string,
  siteName: string,
  location: Location,
  identifier?: string,
): GeofenceRegion {
  return {
    identifier: identifier ?? `task:${taskId}`,
    taskId,
    siteName,
    lat: location.lat,
    lng: location.lng,
    radiusMeters: location.radiusMeters,
  };
}
