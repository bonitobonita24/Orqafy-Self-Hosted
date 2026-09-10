// Backend endpoint resolution for the mobile app (chunk 3b).
//
// LAN-first (D-15): the operator self-hosts and points the app at their own
// server. Expo statically inlines any `EXPO_PUBLIC_*` env var at build time, so
// `process.env.EXPO_PUBLIC_API_URL` is the single knob. Falls back to the dev
// web port for a local build with no env set.
//
// Pure module (no native imports) — safe to import anywhere.

/** Dev default — the web app's random dev port (Rule 22 / inputs.yml). */
const DEFAULT_API_URL = 'http://localhost:56483';

/** Drop any trailing slash so the `${API_URL}/api/...` joins are clean. */
function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

const configured = process.env.EXPO_PUBLIC_API_URL;

/** Backend base URL, no trailing slash (e.g. `http://localhost:56483`). */
export const API_URL = stripTrailingSlash(
  configured !== undefined && configured.length > 0 ? configured : DEFAULT_API_URL,
);

/** tRPC HTTP endpoint the typed client batches against. */
export const TRPC_URL = `${API_URL}/api/trpc`;

/** Mobile bearer-token login endpoint (chunk 3a server path). */
export const MOBILE_LOGIN_URL = `${API_URL}/api/mobile/login`;
