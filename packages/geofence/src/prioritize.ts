// iOS 20-region prioritisation.
//
// iOS monitors at most **20** regions simultaneously (R6 §4); Android allows
// 100. A worker may have more assigned site-tasks than the platform cap, so we
// arm only the nearest N and re-arm as the worker moves (cache-driven re-arming,
// R6 §5). This module picks that active subset deterministically.

import type { GeoPoint, GeofenceRegion } from './region';
import { haversineMeters } from './distance';

/** Default iOS simultaneous-region cap. Android callers can pass 100. */
export const IOS_REGION_CAP = 20;

/** A region annotated with its distance from the reference point (metres). */
export interface RankedRegion {
  region: GeofenceRegion;
  distanceMeters: number;
}

/**
 * Rank every region by distance from `origin`, nearest first. Stable for equal
 * distances (preserves input order), so re-arming does not thrash on ties.
 */
export function rankRegionsByDistance(
  regions: readonly GeofenceRegion[],
  origin: GeoPoint,
): RankedRegion[] {
  return regions
    .map((region, index) => ({
      region,
      distanceMeters: haversineMeters(origin, region),
      index,
    }))
    .sort((a, b) => {
      if (a.distanceMeters === b.distanceMeters) {
        return a.index - b.index;
      }
      return a.distanceMeters - b.distanceMeters;
    })
    .map(({ region, distanceMeters }) => ({ region, distanceMeters }));
}

/**
 * Select the nearest `cap` regions to arm on the OS geofencing subsystem.
 * The result is what gets handed to `startGeofencingAsync`, which replaces the
 * previously-monitored set (R6 §2).
 */
export function prioritizeRegions(
  regions: readonly GeofenceRegion[],
  origin: GeoPoint,
  cap: number = IOS_REGION_CAP,
): GeofenceRegion[] {
  if (cap <= 0) {
    return [];
  }
  return rankRegionsByDistance(regions, origin)
    .slice(0, cap)
    .map((ranked) => ranked.region);
}
