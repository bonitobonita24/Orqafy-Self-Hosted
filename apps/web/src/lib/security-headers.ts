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
 */
export function buildCsp(env: Record<string, string | undefined> = process.env): string {
  const directives = BASE_CSP_DIRECTIVES.map((directive) => {
    const extra = env.CSP_EXTRA_IMG_SRC?.trim();
    if (directive.startsWith('img-src') && extra) {
      return `${directive} ${extra}`;
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
    // Rule 35 SEO Foundation (.ai_prompt/seo.md §1): Orqafy has no public
    // marketing surface — every route is noindex,nofollow (see
    // app/layout.tsx, app/login/page.tsx, app/setup/page.tsx `robots`
    // metadata + app/robots.ts/app/sitemap.ts). Applied as a response header
    // on EVERY route (not just authed ones) because that decision holds
    // uniformly here; a crawler respecting either signal is blocked.
    { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
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
