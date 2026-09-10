// PURE geofence adapter (chunk 4) — translates between `@orqafy/geofence` (shared,
// pure) and the `expo-location` geofencing shapes.
//
// Deliberately native-free at RUNTIME: it imports `@orqafy/geofence` (pure TS) and
// `LocationRegion` only as a TYPE from `expo-location` (erased at compile time). So
// this module — and its tests — run in plain Node/vitest with no Expo native module
// resolution. The thin native callers (task.ts, arming.ts, notifications.ts) own the
// actual `expo-*` runtime imports.
import { type GeofenceRegion, type GeoPoint, prioritizeRegions } from '@orqafy/geofence';
import type { LocationRegion } from 'expo-location';

/**
 * Map one shared `GeofenceRegion` onto the `expo-location` `LocationRegion` shape
 * handed to `startGeofencingAsync`. Both notify flags are enabled: we need ENTER
 * (start the dwell timer) and EXIT (cancel it).
 */
export function toLocationRegion(r: GeofenceRegion): LocationRegion {
  return {
    identifier: r.identifier,
    latitude: r.lat,
    longitude: r.lng,
    radius: r.radiusMeters,
    notifyOnEnter: true,
    notifyOnExit: true,
  };
}

/**
 * Prioritise the region set to the platform cap (nearest-first, default 20 per the
 * iOS limit — see `@orqafy/geofence` `prioritizeRegions`) and map each survivor to a
 * `LocationRegion`. The result is exactly what `startGeofencingAsync` monitors; a
 * subsequent call REPLACES the monitored set, which is how re-arming works.
 */
export function toLocationRegions(
  regions: readonly GeofenceRegion[],
  origin: GeoPoint,
  cap?: number,
): LocationRegion[] {
  return prioritizeRegions(regions, origin, cap).map(toLocationRegion);
}

/**
 * Normalise a native geofencing event-type NUMBER to our vocabulary. Takes a plain
 * `number` (not the enum) so no runtime enum import is needed here: the values are
 * `expo-location`'s `LocationGeofencingEventType.Enter = 1` and `.Exit = 2`; any
 * other value yields `null` (ignored by the caller).
 */
export function mapEventType(n: number): 'enter' | 'exit' | null {
  if (n === 1) return 'enter';
  if (n === 2) return 'exit';
  return null;
}

/**
 * Build the arrival notification content shown when the app-side dwell timer fires.
 * Chunk 4 keeps it a simple, friendly arrival message; chunk 5 will enrich it with
 * the site name and a "N things to do here" task count from the cached read-model.
 * Pure function (no I/O) so it is unit-testable and callable from the background task.
 */
export function arrivalNotificationContent(
  regionIdentifier: string,
): { title: string; body: string } {
  // `regionIdentifier` is accepted now so chunk 5 can key content off the region
  // without changing the signature; the plain message does not need it yet.
  void regionIdentifier;
  return {
    title: "You've arrived on site",
    body: "You're at a job site — open Orqafy to see what's here.",
  };
}
