import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildCsp, buildHeadersConfig, buildSecurityHeaders } from './lib/security-headers';

// The exact production script-src string, pinned so a future edit can't
// silently widen the production CSP while "just" tweaking the dev path.
const PROD_SCRIPT_SRC = "script-src 'self' 'unsafe-inline'";

describe('security headers (audit M-3)', () => {
  const ORIGINAL_EXTRA_IMG_SRC = process.env.CSP_EXTRA_IMG_SRC;

  afterEach(() => {
    if (ORIGINAL_EXTRA_IMG_SRC === undefined) {
      delete process.env.CSP_EXTRA_IMG_SRC;
    } else {
      process.env.CSP_EXTRA_IMG_SRC = ORIGINAL_EXTRA_IMG_SRC;
    }
  });

  it('applies the header set to every route via /:path*', () => {
    const config = buildHeadersConfig();
    expect(config).toHaveLength(1);
    expect(config[0]?.source).toBe('/:path*');
  });

  it('sets every expected header key', () => {
    const headers = buildSecurityHeaders();
    const keys = headers.map((h) => h.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        'Content-Security-Policy',
        'Strict-Transport-Security',
        'X-Content-Type-Options',
        'Referrer-Policy',
        'X-Frame-Options',
      ]),
    );
  });

  it('builds an app-correct CSP (self-hosted fonts, OSM tiles, no framing)', () => {
    const headers = buildSecurityHeaders();
    const csp = headers.find((h) => h.key === 'Content-Security-Policy')?.value ?? '';
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain('img-src');
    expect(csp).toContain('https://*.tile.openstreetmap.org');
  });

  describe('CSP_EXTRA_IMG_SRC deployment hook', () => {
    beforeEach(() => {
      process.env.CSP_EXTRA_IMG_SRC = 'https://tiles.example.org';
    });

    it('appends the extra origin to img-src', () => {
      const headers = buildSecurityHeaders();
      const csp = headers.find((h) => h.key === 'Content-Security-Policy')?.value ?? '';
      const imgSrcDirective = csp.split('; ').find((d) => d.startsWith('img-src'));
      expect(imgSrcDirective).toContain('https://tiles.example.org');
    });
  });

  describe('dev-only unsafe-eval allowance (Fast Refresh CSP fix)', () => {
    it('production (NODE_ENV=production) script-src is byte-identical to the pre-fix baseline', () => {
      const csp = buildCsp({ NODE_ENV: 'production' });
      const scriptSrc = csp.split('; ').find((d) => d.startsWith('script-src'));
      expect(scriptSrc).toBe(PROD_SCRIPT_SRC);
    });

    it('an unset NODE_ENV (e.g. test) also stays on the production script-src string', () => {
      const csp = buildCsp({});
      const scriptSrc = csp.split('; ').find((d) => d.startsWith('script-src'));
      expect(scriptSrc).toBe(PROD_SCRIPT_SRC);
    });

    it("development (NODE_ENV=development) appends 'unsafe-eval' to script-src only", () => {
      const csp = buildCsp({ NODE_ENV: 'development' });
      const scriptSrc = csp.split('; ').find((d) => d.startsWith('script-src'));
      expect(scriptSrc).toBe(`${PROD_SCRIPT_SRC} 'unsafe-eval'`);
    });

    it('development does not change any other directive', () => {
      const prodCsp = buildCsp({ NODE_ENV: 'production' });
      const devCsp = buildCsp({ NODE_ENV: 'development' });
      const stripDirective = (csp: string, prefix: string) =>
        csp
          .split('; ')
          .filter((d) => !d.startsWith(prefix))
          .join('; ');
      expect(stripDirective(devCsp, 'script-src')).toBe(stripDirective(prodCsp, 'script-src'));
    });
  });
});
