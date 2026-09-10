// Unit tests for the PURE geofence adapter (chunk 4). Runs in vitest's node env:
// the adapter imports only `@orqafy/geofence` (pure) at runtime and `LocationRegion`
// as a TYPE from expo-location (erased), so no native module is resolved here.
import { describe, expect, it } from 'vitest';

import type { GeofenceRegion } from '@orqafy/geofence';

import {
  arrivalNotificationContent,
  mapEventType,
  toLocationRegion,
  toLocationRegions,
} from './adapter';

function region(overrides: Partial<GeofenceRegion> = {}): GeofenceRegion {
  return {
    identifier: 'task:1',
    taskId: '1',
    siteName: 'Site One',
    lat: 14.5,
    lng: 121.0,
    radiusMeters: 75,
    ...overrides,
  };
}

describe('toLocationRegion', () => {
  it('maps a GeofenceRegion onto expo-location field names with both notify flags true', () => {
    const r = region({ identifier: 'task:42', lat: 10.1, lng: 20.2, radiusMeters: 150 });
    const loc = toLocationRegion(r);
    expect(loc).toEqual({
      identifier: 'task:42',
      latitude: 10.1,
      longitude: 20.2,
      radius: 150,
      notifyOnEnter: true,
      notifyOnExit: true,
    });
  });
});

describe('toLocationRegions', () => {
  it('applies the cap and returns the nearest-first LocationRegion-shaped set', () => {
    const origin = { lat: 0, lng: 0 };
    // 4 regions at increasing longitude (increasing distance from origin).
    // Nearest → farthest by identifier: near, mid1, mid2, far.
    const regions: GeofenceRegion[] = [
      region({ identifier: 'far', lat: 0, lng: 3 }),
      region({ identifier: 'near', lat: 0, lng: 0.5 }),
      region({ identifier: 'mid2', lat: 0, lng: 2 }),
      region({ identifier: 'mid1', lat: 0, lng: 1 }),
    ];
    const cap = 3;
    const out = toLocationRegions(regions, origin, cap);

    expect(out).toHaveLength(cap); // cap enforced (>= cap+1 regions supplied)
    expect(out.map((r) => r.identifier)).toEqual(['near', 'mid1', 'mid2']); // nearest-first, 'far' dropped
    // Each item is LocationRegion-shaped.
    for (const r of out) {
      expect(typeof r.identifier).toBe('string');
      expect(typeof r.latitude).toBe('number');
      expect(typeof r.longitude).toBe('number');
      expect(typeof r.radius).toBe('number');
      expect(r.notifyOnEnter).toBe(true);
      expect(r.notifyOnExit).toBe(true);
    }
  });
});

describe('mapEventType', () => {
  it('maps 1 (LocationGeofencingEventType.Enter) to "enter"', () => {
    expect(mapEventType(1)).toBe('enter');
  });
  it('maps 2 (LocationGeofencingEventType.Exit) to "exit"', () => {
    expect(mapEventType(2)).toBe('exit');
  });
  it('maps any other value to null', () => {
    expect(mapEventType(0)).toBeNull();
    expect(mapEventType(3)).toBeNull();
    expect(mapEventType(-1)).toBeNull();
  });
});

describe('arrivalNotificationContent', () => {
  it('returns a non-empty title and body', () => {
    const content = arrivalNotificationContent('task:7');
    expect(content.title.length).toBeGreaterThan(0);
    expect(content.body.length).toBeGreaterThan(0);
  });
});
