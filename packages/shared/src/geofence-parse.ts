// Pure helper bridging the Task form's STRING geofence inputs (the shape a native
// <input type="number"> produces) and the numeric shape the map picker + the
// `locationSchema` (primitives.ts) consume. UI-framework-agnostic and total: it
// never throws — a blank, whitespace-only, or non-numeric field parses to `null`
// so a partially-filled geofence still renders what it can.

/** A number parsed from a form string, or `null` when empty/whitespace/NaN. */
function toNumberOrNull(value: string | undefined): number | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const n = Number.parseFloat(trimmed);
  return Number.isNaN(n) ? null : n;
}

export interface GeofenceStrings {
  lat?: string | undefined;
  lng?: string | undefined;
  radius?: string | undefined;
}

export interface GeofenceNumbers {
  lat: number | null;
  lng: number | null;
  radiusMeters: number | null;
}

/**
 * Convert the three geofence form strings to numbers (radius → `radiusMeters`).
 * Missing/blank/non-numeric fields become `null`; never throws.
 */
export function parseGeofenceStrings(strings: GeofenceStrings): GeofenceNumbers {
  return {
    lat: toNumberOrNull(strings.lat),
    lng: toNumberOrNull(strings.lng),
    radiusMeters: toNumberOrNull(strings.radius),
  };
}
