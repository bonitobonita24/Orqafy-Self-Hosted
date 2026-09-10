// Geofence arming/disarming (chunk 4) — the native orchestration entry point the app
// calls to (re-)arm the OS geofencing subsystem from the current region set + origin.
//
// `startGeofencingAsync(TASK, regions)` REPLACES the previously-monitored set, so a
// single call both arms and re-arms. The region set is prioritised to the platform cap
// (iOS monitors at most 20 simultaneously) by `toLocationRegions` → `prioritizeRegions`,
// so as the worker moves the caller re-invokes `armGeofences` with a fresh origin and
// the nearest 20 are always the monitored set (cache-driven re-arming, R6 §5).
//
// `import './task'` is a SIDE-EFFECT import: it runs the module-scope `defineTask`, so
// the background task is defined before geofencing starts (defineTask must run in the
// global scope — see task.ts).
import * as Location from 'expo-location';

import type { GeofenceRegion, GeoPoint } from '@orqafy/geofence';

import { toLocationRegions } from './adapter';
import { GEOFENCE_TASK } from './constants';
import { configureNotifications, ensureNotificationPermissions } from './notifications';

import './task';

/**
 * Ensure the location permissions geofencing needs. Foreground is required; background
 * is needed for the OS to deliver events while the app is asleep (the product's whole
 * point). A denied BACKGROUND grant is logged but NOT fatal — we still arm, so the app
 * gets foreground-visible geofence events rather than nothing. Never throws.
 */
async function ensureLocationPermissions(): Promise<void> {
  try {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (!fg.granted) {
      console.warn('[geofence] foreground location permission denied — arming anyway');
    }
    const bg = await Location.requestBackgroundPermissionsAsync();
    if (!bg.granted) {
      console.warn('[geofence] background location permission denied — background alerts unavailable');
    }
  } catch (err) {
    console.warn('[geofence] location permission request failed', err);
  }
}

/**
 * Arm (or re-arm) geofencing for `regions`, monitoring the nearest `cap` (default 20)
 * to `origin`. An empty prioritised set stops any running geofencing (nothing to
 * monitor); otherwise `startGeofencingAsync` replaces the monitored set. Wrapped so a
 * native failure logs and does not throw up the stack.
 */
export async function armGeofences(regions: GeofenceRegion[], origin: GeoPoint): Promise<void> {
  configureNotifications();
  await ensureNotificationPermissions();
  await ensureLocationPermissions();

  const locRegions = toLocationRegions(regions, origin);
  try {
    if (locRegions.length === 0) {
      // Nothing to monitor — tear down any active monitoring so a stale set is not left armed.
      if (await Location.hasStartedGeofencingAsync(GEOFENCE_TASK)) {
        await Location.stopGeofencingAsync(GEOFENCE_TASK);
      }
      return;
    }
    // Replaces the previously-monitored set — this IS the re-arm (iOS 20-cap already
    // enforced by prioritizeRegions inside toLocationRegions).
    await Location.startGeofencingAsync(GEOFENCE_TASK, locRegions);
  } catch (err) {
    console.warn('[geofence] failed to (re)arm geofencing', err);
  }
}

/** Stop all geofencing monitoring (e.g. on sign-out). No-op if not started. Never throws. */
export async function stopGeofences(): Promise<void> {
  try {
    if (await Location.hasStartedGeofencingAsync(GEOFENCE_TASK)) {
      await Location.stopGeofencingAsync(GEOFENCE_TASK);
    }
  } catch (err) {
    console.warn('[geofence] failed to stop geofencing', err);
  }
}
