// Regression tests for the document DOWNLOAD route's stored-XSS hardening
// (audit M-5). The stored `mimeType` is attacker-influenced (it originates
// from a client-declared upload Content-Type, now gated by an allowlist at
// upload time — apps/web/src/app/api/media/route.ts — but this route is a
// SECOND, independent layer that must neutralize active content regardless).
import { describe, expect, it, vi } from 'vitest';
import type { Session } from 'next-auth';

const doc = vi.hoisted(() => ({
  row: null as null | { id: string; name: string; mimeType: string; isSPI: boolean },
}));

vi.mock('@orqafy/db', () => ({
  prisma: {
    document: { findUnique: () => Promise.resolve(doc.row) },
  },
}));
vi.mock('@/auth', () => ({
  auth: (): Promise<Session | null> =>
    Promise.resolve({ user: { id: 'u1' }, expires: '2099-01-01T00:00:00.000Z' } as Session),
}));
vi.mock('@/server/permissions', () => ({
  resolveUserPermissions: () => Promise.resolve(new Set(['view_finances'])),
}));
vi.mock('@/server/storage', () => ({
  getStorageAdapter: () => ({
    getObject: () => Promise.resolve({ body: new Uint8Array([1, 2, 3]), size: 3 }),
  }),
}));

const { GET, safeDownloadContentType } = await import('./route');

describe('safeDownloadContentType — risky-type override (audit M-5)', () => {
  it('forces text/html to a forced download', () => {
    expect(safeDownloadContentType('text/html')).toBe('application/octet-stream');
  });

  it('forces image/svg+xml to a forced download', () => {
    expect(safeDownloadContentType('image/svg+xml')).toBe('application/octet-stream');
  });

  it('passes a safe type through unchanged', () => {
    expect(safeDownloadContentType('image/png')).toBe('image/png');
  });

  it('strips a charset parameter before matching a risky type', () => {
    expect(safeDownloadContentType('text/html; charset=utf-8')).toBe('application/octet-stream');
  });

  it('is case-insensitive on the base type', () => {
    expect(safeDownloadContentType('TEXT/HTML')).toBe('application/octet-stream');
  });
});

describe('GET /api/media/[id] — download headers (audit M-5)', () => {
  it('serves a stored text/html doc as a forced download with nosniff + sandbox CSP', async () => {
    doc.row = { id: 'd1', name: 'evil.html', mimeType: 'text/html', isSPI: false };
    const res = await GET(new Request('http://localhost/api/media/d1'), {
      params: Promise.resolve({ id: 'd1' }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/octet-stream');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('Content-Security-Policy')).toContain('sandbox');
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    expect(res.headers.get('Content-Disposition')).toContain('attachment');
  });

  it('serves a legit image/png doc with its real type, still nosniff-hardened', async () => {
    doc.row = { id: 'd2', name: 'photo.png', mimeType: 'image/png', isSPI: false };
    const res = await GET(new Request('http://localhost/api/media/d2'), {
      params: Promise.resolve({ id: 'd2' }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });
});
