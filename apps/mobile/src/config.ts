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

/**
 * True when `url` points at a non-local host over a non-https protocol — i.e. the
 * bearer token + password would cross the network in cleartext. localhost /
 * 127.0.0.1 (any protocol) and any https URL are considered safe.
 *
 * Parses protocol + host manually rather than via the `URL` global, whose support
 * is patchy under Hermes. Robust to `http://192.168.1.10:56483`, userinfo
 * (`user:pass@host`), ports, and trailing path/query/hash.
 */
export function isInsecureRemote(url: string): boolean {
  const schemeSplit = url.indexOf('://');
  if (schemeSplit === -1) {
    return false;
  }
  const protocol = url.slice(0, schemeSplit).toLowerCase();
  if (protocol === 'https') {
    return false;
  }

  // Authority = everything up to the first '/', '?' or '#'.
  let authority = url.slice(schemeSplit + 3);
  const end = authority.search(/[/?#]/);
  if (end !== -1) {
    authority = authority.slice(0, end);
  }

  // Drop any `userinfo@` prefix, then any `:port` suffix.
  const at = authority.lastIndexOf('@');
  if (at !== -1) {
    authority = authority.slice(at + 1);
  }
  const colon = authority.indexOf(':');
  const host = (colon === -1 ? authority : authority.slice(0, colon)).toLowerCase();

  const isLocal = host === 'localhost' || host === '127.0.0.1';
  return !isLocal;
}

// Warn (dev only) when the configured backend would send credentials in the clear.
if (typeof __DEV__ !== 'undefined' && __DEV__ && isInsecureRemote(API_URL)) {
  // eslint-disable-next-line no-console
  console.warn(
    `[orqafy] API_URL "${API_URL}" is a non-localhost host over http — the bearer ` +
      'token and password will traverse the network in CLEARTEXT. Use https for any ' +
      'non-localhost / LAN-exposed backend (terminate TLS at the Pangolin/Traefik tunnel).',
  );
}

/** tRPC HTTP endpoint the typed client batches against. */
export const TRPC_URL = `${API_URL}/api/trpc`;

/** Mobile bearer-token login endpoint (chunk 3a server path). */
export const MOBILE_LOGIN_URL = `${API_URL}/api/mobile/login`;
