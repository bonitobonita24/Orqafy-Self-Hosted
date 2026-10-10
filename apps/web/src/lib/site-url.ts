// Resolves the absolute base URL `metadata.metadataBase` / `sitemap.ts` /
// `robots.ts` need, without ever hardcoding a domain (Rule 35 — every
// self-hosted install has its own unknown domain).
//
// Precedence: NEXT_PUBLIC_APP_URL (explicit SEO-base override, not required)
// > AUTH_URL (Auth.js v5's own canonical origin — already configured per env
// in .env.example, so most installs need no new env var at all) > a
// localhost fallback so `next build`/`metadataBase` never throws on a missing
// value in dev/CI.
//
// Pure + dependency-free (mirrors lib/security-headers.ts) so it is
// unit-testable without a Next.js runtime.

const FALLBACK_SITE_URL = 'http://localhost:3000';

export function resolveSiteUrl(env: Record<string, string | undefined> = process.env): string {
  const candidate = env.NEXT_PUBLIC_APP_URL ?? env.AUTH_URL ?? FALLBACK_SITE_URL;
  try {
    return new URL(candidate).origin;
  } catch {
    // An unparsable value (typo, missing scheme) never crashes metadata
    // generation — fall back to the safe default and let the operator notice
    // their SEO/canonical URLs look wrong, rather than 500ing the whole app.
    return FALLBACK_SITE_URL;
  }
}
