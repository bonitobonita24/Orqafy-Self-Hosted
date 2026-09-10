// Unit tests for the PURE geofence-arming authorization boundary (chunk 5, finding #3).
//
// Only `selectArmableRegions` is exercised — the native `useTaskGeofencing` hook needs a
// device and is out of scope here. `task-geofencing.ts` imports `expo-location` and
// `./arming` at module scope (for the hook), so both are mocked to keep the module
// loadable in vitest's node env — the selector itself touches neither.
import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-location', () => ({ getCurrentPositionAsync: vi.fn() }));
vi.mock('./arming', () => ({ armGeofences: vi.fn() }));

import { selectArmableRegions, type ArmableTask } from './task-geofencing';

const NOW = new Date('2026-06-15T12:00:00.000Z');
const LOCATION = { lat: 14.6091, lng: 120.9822, radiusMeters: 120 };

function task(overrides: Partial<ArmableTask> = {}): ArmableTask {
  return {
    id: 't1',
    title: 'Pour foundation',
    project: { name: 'Harbor Tower' },
    location: LOCATION,
    ...overrides,
  };
}

describe('selectArmableRegions', () => {
  it('excludes tasks with no site location', () => {
    // Explicitly null...
    expect(selectArmableRegions([task({ location: null })], NOW)).toEqual([]);
    // ...and absent (property omitted → undefined).
    const noLocation: ArmableTask = { id: 't2', title: 'Sign off drawings' };
    expect(selectArmableRegions([noLocation], NOW)).toEqual([]);
  });

  it('excludes tasks whose active window has not opened yet (now < from)', () => {
    const future = new Date('2026-07-01T00:00:00.000Z');
    expect(selectArmableRegions([task({ geofenceActiveFrom: future })], NOW)).toEqual([]);
  });

  it('excludes tasks whose active window has already closed (now > until)', () => {
    const past = new Date('2026-06-01T00:00:00.000Z');
    expect(selectArmableRegions([task({ geofenceActiveUntil: past })], NOW)).toEqual([]);
  });

  it('includes tasks with open (null/absent) bounds', () => {
    const openBoth = selectArmableRegions([task()], NOW);
    expect(openBoth).toHaveLength(1);

    const nullBounds = selectArmableRegions(
      [task({ geofenceActiveFrom: null, geofenceActiveUntil: null })],
      NOW,
    );
    expect(nullBounds).toHaveLength(1);
  });

  it('includes tasks when now sits inside the window', () => {
    const regions = selectArmableRegions(
      [
        task({
          geofenceActiveFrom: new Date('2026-06-01T00:00:00.000Z'),
          geofenceActiveUntil: new Date('2026-07-01T00:00:00.000Z'),
        }),
      ],
      NOW,
    );
    expect(regions).toHaveLength(1);
  });

  it('maps identifier/siteName/lat/lng/radiusMeters correctly', () => {
    const [region] = selectArmableRegions([task()], NOW);
    expect(region).toMatchObject({
      identifier: 'task:t1',
      taskId: 't1',
      siteName: 'Harbor Tower',
      lat: LOCATION.lat,
      lng: LOCATION.lng,
      radiusMeters: LOCATION.radiusMeters,
    });
  });

  it('falls back to the task title as siteName when there is no project', () => {
    const [region] = selectArmableRegions([task({ project: null })], NOW);
    expect(region?.siteName).toBe('Pour foundation');
  });

  it('handles string-date bounds (revived before comparison)', () => {
    // In-window string bounds → included.
    const inWindow = selectArmableRegions(
      [task({ geofenceActiveFrom: '2026-06-01T00:00:00.000Z', geofenceActiveUntil: '2026-07-01T00:00:00.000Z' })],
      NOW,
    );
    expect(inWindow).toHaveLength(1);

    // A string `from` in the future → excluded.
    const notYet = selectArmableRegions([task({ geofenceActiveFrom: '2026-08-01T00:00:00.000Z' })], NOW);
    expect(notYet).toEqual([]);
  });
});
