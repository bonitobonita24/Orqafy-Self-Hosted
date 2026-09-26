// Regression test for the edge-middleware matcher (ORQ-31).
//
// Next runs middleware only on paths the `config.matcher` selects, and for
// every matched request it clones + buffers the body up to
// `experimental.middlewareClientMaxBodySize` (default 10 MB). Anything beyond
// that is silently dropped before the Route Handler reads it, so a 12 MiB photo
// reached /api/photos truncated and failed multipart parsing (400). The upload
// routes therefore MUST be excluded from the matcher; every other path keeps
// the middleware's auth redirect.
//
// The matcher is compiled with Next's own compiler (the same functions the
// router uses), so this asserts real routing behavior, not a hand-rolled regex.
import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';
import { getMiddlewareRouteMatcher } from 'next/dist/shared/lib/router/utils/middleware-route-matcher';

// `getMiddlewareMatchers` is exported at runtime but not in Next's .d.ts.
type CompiledMatcher = { regexp: string; originalSource: string };
const { getMiddlewareMatchers } = createRequire(import.meta.url)(
  'next/dist/build/analysis/get-page-static-info',
) as {
  getMiddlewareMatchers: (matcher: string[], nextConfig: object) => CompiledMatcher[];
};

// The middleware module builds an Auth.js instance at import time; only its
// static `config` is under test here.
vi.mock('next-auth', () => ({
  default: () => ({ auth: (fn: unknown) => fn }),
}));
vi.mock('@/auth.config', () => ({ authConfig: {} }));

const { config } = await import('./middleware');

const matches = getMiddlewareRouteMatcher(
  getMiddlewareMatchers(config.matcher, { i18n: null, basePath: '' }),
);
const runsMiddleware = (pathname: string): boolean => matches(pathname, undefined as never, {});

describe('middleware matcher', () => {
  it.each(['/api/photos', '/api/photos/', '/api/media', '/api/media/', '/api/media/abc'])(
    'does NOT run middleware on upload route %s (no 10 MB body cap)',
    (path) => {
      expect(runsMiddleware(path)).toBe(false);
    },
  );

  it.each([
    '/',
    '/dashboard',
    '/files',
    '/login',
    '/api/trpc/documents.list',
    '/api/auth/session',
    '/api/mobile/login',
    '/api/photosX',
    '/api/mediaX',
    '/api/photos-archive',
  ])('still runs middleware on %s', (path) => {
    expect(runsMiddleware(path)).toBe(true);
  });

  it('keeps excluding static assets and Next internals', () => {
    expect(runsMiddleware('/_next/static/chunk.js')).toBe(false);
    expect(runsMiddleware('/favicon.ico')).toBe(false);
    expect(runsMiddleware('/logo.png')).toBe(false);
  });
});
