import { describe, expect, it } from 'vitest';

import {
  DEFAULT_DWELL_MS,
  DwellTracker,
  IOS_REGION_CAP,
  RegionState,
  evaluateRegionState,
  haversineMeters,
  isInsideRegion,
  prioritizeRegions,
  regionFromLocation,
} from '../index';
import type { GeofenceRegion } from '../index';

const site = (id: string, lat: number, lng: number, radiusMeters = 100): GeofenceRegion => ({
  identifier: `task:${id}`,
  taskId: id,
  siteName: `Site ${id}`,
  lat,
  lng,
  radiusMeters,
});

describe('haversineMeters', () => {
  it('returns 0 for the same point', () => {
    expect(haversineMeters({ lat: 14.5, lng: 121 }, { lat: 14.5, lng: 121 })).toBe(0);
  });

  it('approximates a known short distance (~111m per 0.001° latitude)', () => {
    const d = haversineMeters({ lat: 14.5, lng: 121 }, { lat: 14.501, lng: 121 });
    expect(d).toBeGreaterThan(105);
    expect(d).toBeLessThan(118);
  });
});

describe('evaluateRegionState', () => {
  const region = site('A', 14.5, 121, 100);

  it('reports Inside when within the radius', () => {
    expect(evaluateRegionState({ lat: 14.5, lng: 121 }, region)).toBe(RegionState.Inside);
    expect(isInsideRegion({ lat: 14.5005, lng: 121 }, region)).toBe(true);
  });

  it('reports Outside when beyond the radius', () => {
    expect(evaluateRegionState({ lat: 14.51, lng: 121 }, region)).toBe(RegionState.Outside);
    expect(isInsideRegion({ lat: 14.51, lng: 121 }, region)).toBe(false);
  });
});

describe('regionFromLocation', () => {
  it('maps a shared Location value object onto a GeofenceRegion', () => {
    const r = regionFromLocation('t1', 'North Tower', {
      lat: 10,
      lng: 20,
      radiusMeters: 75,
    });
    expect(r).toMatchObject({ identifier: 'task:t1', taskId: 't1', radiusMeters: 75 });
  });
});

describe('prioritizeRegions (iOS 20-region cap)', () => {
  it('defaults the cap to 20', () => {
    expect(IOS_REGION_CAP).toBe(20);
  });

  it('arms only the nearest N regions', () => {
    const origin = { lat: 0, lng: 0 };
    // 25 regions marching east; nearest = smallest lng.
    const regions = Array.from({ length: 25 }, (_, i) => site(String(i), 0, (i + 1) * 0.01));
    const armed = prioritizeRegions(regions, origin);
    expect(armed).toHaveLength(20);
    expect(armed[0]?.taskId).toBe('0');
    expect(armed.at(-1)?.taskId).toBe('19');
  });

  it('honours a custom cap and returns [] for a non-positive cap', () => {
    const regions = [site('a', 0, 0.01), site('b', 0, 0.02)];
    expect(prioritizeRegions(regions, { lat: 0, lng: 0 }, 1)).toHaveLength(1);
    expect(prioritizeRegions(regions, { lat: 0, lng: 0 }, 0)).toHaveLength(0);
  });
});

describe('DwellTracker', () => {
  it('uses a 3-minute default threshold', () => {
    expect(DEFAULT_DWELL_MS).toBe(180_000);
  });

  it('fires dwelled once the threshold elapses while still inside', () => {
    const t = new DwellTracker({ dwellMs: 1000 });
    t.handleEvent({ regionId: 'r1', type: 'enter', at: 0 });
    expect(t.phaseOf('r1')).toBe('pending');
    expect(t.collectDwelled(500)).toHaveLength(0); // not yet
    const fired = t.collectDwelled(1000);
    expect(fired).toHaveLength(1);
    expect(fired[0]).toMatchObject({ regionId: 'r1', enteredAt: 0, dwelledAt: 1000 });
    expect(t.phaseOf('r1')).toBe('dwelled');
    // idempotent within the stay
    expect(t.collectDwelled(5000)).toHaveLength(0);
  });

  it('cancels the dwell when the worker exits before the threshold', () => {
    const t = new DwellTracker({ dwellMs: 1000 });
    t.handleEvent({ regionId: 'r1', type: 'enter', at: 0 });
    t.handleEvent({ regionId: 'r1', type: 'exit', at: 400 });
    expect(t.phaseOf('r1')).toBe('outside');
    expect(t.collectDwelled(2000)).toHaveLength(0);
  });

  it('re-arms after an exit then a fresh enter', () => {
    const t = new DwellTracker({ dwellMs: 1000 });
    t.handleEvent({ regionId: 'r1', type: 'enter', at: 0 });
    t.collectDwelled(1000);
    t.handleEvent({ regionId: 'r1', type: 'exit', at: 1500 });
    t.handleEvent({ regionId: 'r1', type: 'enter', at: 2000 });
    expect(t.phaseOf('r1')).toBe('pending');
    expect(t.collectDwelled(3000)).toHaveLength(1);
  });
});
