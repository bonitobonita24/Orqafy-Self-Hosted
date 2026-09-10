// Persistent bearer-token store (chunk 3b).
//
// Thin wrapper over expo-secure-store (Keychain / Keystore backed). NATIVE:
// typecheck-only in this environment — never exercised by vitest. All calls are
// wrapped so a missing key / unavailable store degrades to `null` rather than
// throwing, which the AuthContext treats as "signed out".
import * as SecureStore from 'expo-secure-store';

/** SecureStore key for the long-lived mobile session token. */
export const TOKEN_KEY = 'orqafy.mobile.token';

/** Persist the bearer token. */
export async function saveToken(token: string): Promise<void> {
  // AFTER_FIRST_UNLOCK: the token stays readable for background geofence work
  // after a reboot (once the user unlocks once), but is never accessible while
  // the device has never been unlocked — the standard bearer-at-rest posture.
  await SecureStore.setItemAsync(TOKEN_KEY, token, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
  });
}

/** Read the bearer token, or `null` if absent / unreadable. */
export async function getToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

/** Remove the stored token (sign-out / expiry). */
export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
