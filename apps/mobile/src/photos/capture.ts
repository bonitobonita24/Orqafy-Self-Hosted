// Capture-time device helpers (D-28). NATIVE (expo-file-system, expo-location):
// typecheck-only here — never imported by vitest.
//
// expo-file-system SDK 54: the package root exports the NEW object API
// (`File` / `Directory` / `Paths`); the old function API moved to
// `expo-file-system/legacy`. We use the new API.
import { Directory, File, Paths } from 'expo-file-system';
import * as Location from 'expo-location';

import { newUuid } from '@/offline/uuid-native';

import { resolveWithin } from './timeout';

/** Best-effort GPS budget — capture never waits longer than this for a fix. */
const GPS_TIMEOUT_MS = 5000;

/**
 * Copy a camera capture (cache dir — the OS may purge it before the outbox
 * drains) into `<documents>/photos/<uuid>.jpg` and return the durable URI.
 * The cache original is removed best-effort. Throws if the copy itself fails.
 */
export function persistCapturedPhoto(cacheUri: string): string {
  const dir = new Directory(Paths.document, 'photos');
  dir.create({ idempotent: true, intermediates: true });
  const dest = new File(dir, `${newUuid()}.jpg`);
  const source = new File(cacheUri);
  source.copy(dest);
  try {
    source.delete();
  } catch {
    // Cache cleanup only — the OS reclaims it eventually.
  }
  return dest.uri;
}

/**
 * Foreground GPS fix at `Accuracy.Balanced`, or `null` on denial / error /
 * timeout. Never throws and never blocks longer than GPS_TIMEOUT_MS.
 */
export async function getBestEffortGps(): Promise<{ lat: number; lng: number } | null> {
  const fix = await resolveWithin(
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== Location.PermissionStatus.GRANTED) return null;
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      return { lat: pos.coords.latitude, lng: pos.coords.longitude };
    })(),
    GPS_TIMEOUT_MS,
  );
  return fix;
}
