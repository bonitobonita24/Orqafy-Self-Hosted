import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildHeadersConfig, buildSecurityHeaders } from './lib/security-headers';

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
        'X-Robots-Tag',
      ]),
    );
  });

  it('sends X-Robots-Tag: noindex, nofollow on every route (Rule 35 — no public surface)', () => {
    const headers = buildSecurityHeaders();
    const robotsTag = headers.find((h) => h.key === 'X-Robots-Tag')?.value;
    expect(robotsTag).toBe('noindex, nofollow');
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
});
