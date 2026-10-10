// Security response headers applied to every route via next.config.mjs
// `headers()`. Factored into a pure, dependency-free helper (no next-only
// imports) so it is unit-testable under vitest without loading the ESM
// next.config.mjs module directly.
//
// CSP posture (app-verified, audit M-3):
//  - Fonts are self-hosted via next/font/local (woff2) -> font-src 'self' only.
//  - Leaflet map tiles come from the OSM tile CDN (NEXT_PUBLIC_MAP_TILE_URL,
//    defaulting to *.tile.openstreetmap.org) -> img-src allows that host +
//    data:/blob: (Leaflet/Next also use data: URIs and blob: for canvas/icons).
//  - Realtime is same-origin SSE (tRPC httpSubscriptionLink) -> connect-src 'self'.
//  - Next.js App Router injects an inline bootstrap <script> and inline
//    styles with no nonce pipeline wired up -> script-src/style-src need
//    'unsafe-inline' for v1. POST-V1 SEAM: swap to a per-request nonce
//    (Next middleware `x-nonce` header + `next/script` nonce prop) and drop
//    'unsafe-inline' from both directives once that's in place.
//  - DEV-ONLY: `pnpm dev`'s React Fast Refresh runtime reconstructs
//    server-side error stacks via `eval()` in the browser — Next.js's own
//    CSP guidance (vercel/next.js docs, content-security-policy.mdx)
//    requires `'unsafe-eval'` in script-src for this in development, else
//    every page throws `EvalError: ... violates CSP ... (no 'unsafe-eval')`
//    and React never hydrates. Gated strictly on NODE_ENV==='development' —
//    the PRODUCTION directive string is byte-identical to before this
//    change (verified by a test). `connect-src 'self'` already covers the
//    same-origin HMR WebSocket (ws:) per the CSP spec's origin-matching for
//    'self' — no extra token needed there.
//
// Deployment hook: set CSP_EXTRA_IMG_SRC (space-separated origins) to extend
// img-src for a deployment that points NEXT_PUBLIC_MAP_TILE_URL at a custom
// tile host, without a code change.

export interface SecurityHeader {
  key: string;
  value: string;
}

const BASE_CSP_DIRECTIVES: readonly string[] = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  // v1 posture: no nonce pipeline wired up yet (see module header) — POST-V1 seam.
  // 'unsafe-eval' is appended ONLY in development (see buildCsp below).
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data: blob: https://*.tile.openstreetmap.org",
  "connect-src 'self'",
  "worker-src 'self' blob:",
];

/**
 * Builds the Content-Security-Policy value, honoring the CSP_EXTRA_IMG_SRC
 * deployment hook (space-separated extra img-src origins — e.g. a custom
 * NEXT_PUBLIC_MAP_TILE_URL host).
 *
 * DEV-ONLY (NODE_ENV==='development'): appends `'unsafe-eval'` to
 * script-src so Next.js Fast Refresh's error-stack reconstruction doesn't
 * trip the CSP (see module header). Production's directive string is
 * unchanged — this never fires outside development.
 */
export function buildCsp(env: Record<string, string | undefined> = process.env): string {
  const isDev = env.NODE_ENV === 'development';
  const directives = BASE_CSP_DIRECTIVES.map((directive) => {
    if (directive.startsWith('img-src')) {
      const extra = env.CSP_EXTRA_IMG_SRC?.trim();
      return extra ? `${directive} ${extra}` : directive;
    }
    if (isDev && directive.startsWith('script-src')) {
      return `${directive} 'unsafe-eval'`;
    }
    return directive;
  });
  return directives.join('; ');
}

/**
 * Builds the full set of security response headers applied to every route.
 */
export function buildSecurityHeaders(
  env: Record<string, string | undefined> = process.env,
): SecurityHeader[] {
  return [
    { key: 'Content-Security-Policy', value: buildCsp(env) },
    // Browsers ignore HSTS on plain-http/localhost responses, so this is
    // safe to send unconditionally in dev.
    { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    // Legacy-browser companion to the frame-ancestors CSP directive.
    { key: 'X-Frame-Options', value: 'DENY' },
    // No Permissions-Policy here by design: the map-picker may request
    // geolocation, and a restrictive default would break it.
  ];
}

/**
 * Builds the Next.js `headers()` async config entries — one rule applying
 * `buildSecurityHeaders()` to every route.
 */
export function buildHeadersConfig(env: Record<string, string | undefined> = process.env) {
  return [
    {
      source: '/:path*',
      headers: buildSecurityHeaders(env),
    },
  ];
}
