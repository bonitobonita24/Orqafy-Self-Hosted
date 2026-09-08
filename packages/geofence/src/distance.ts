// Great-circle distance + inside/outside evaluation.
//
// This is the on-device evaluation spec (D-19 / R6 §5): the OS location
// subsystem does the real background triggering, but we keep an authoritative
// pure implementation so (a) the server can reason about the same regions and
// (b) the app can self-check "am I inside?" against cached regions with zero
// network. Pure, deterministic, unit-tested.

import type { GeoPoint, GeofenceRegion } from './region';
import { RegionState } from './region';

/** Mean Earth radius in metres (WGS84 mean), for the haversine formula. */
const EARTH_RADIUS_METERS = 6_371_008.8;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/**
 * Haversine great-circle distance between two lat/lng points, in metres.
 * Accurate to well within a geofence radius at construction-site scale.
 */
export function haversineMeters(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Evaluate whether a point lies inside a region's radius. Returns the
 * Expo-aligned `RegionState` (Inside / Outside). `Unknown` is reserved for the
 * pre-fix case the caller handles before ever calling this.
 */
export function evaluateRegionState(point: GeoPoint, region: GeofenceRegion): RegionState {
  const distance = haversineMeters(point, region);
  return distance <= region.radiusMeters ? RegionState.Inside : RegionState.Outside;
}

/** Convenience predicate over {@link evaluateRegionState}. */
export function isInsideRegion(point: GeoPoint, region: GeofenceRegion): boolean {
  return evaluateRegionState(point, region) === RegionState.Inside;
}
