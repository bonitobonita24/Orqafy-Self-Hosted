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
  await SecureStore.setItemAsync(TOKEN_KEY, token);
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
