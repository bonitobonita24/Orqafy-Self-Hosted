// Regression tests for the document DOWNLOAD route's stored-XSS hardening
// (audit M-5). The stored `mimeType` is attacker-influenced (it originates
// from a client-declared upload Content-Type, now gated by an allowlist at
// upload time — apps/web/src/app/api/media/route.ts — but this route is a
// SECOND, independent layer that must neutralize active content regardless).
import { beforeEach, describe, expect, it, vi } from 'vitest';

const doc = vi.hoisted(() => ({
  row: null as null | { id: string; name: string; mimeType: string; isSPI: boolean },
}));
// Access audit log spy (DPA W10) — auditLog.create records every call so
// tests can assert exactly what GET /api/media/[id] wrote, and
// `auditError` lets a test force the insert to reject (fail-open check).
const audit = vi.hoisted(() => ({
  writes: [] as Array<Record<string, unknown>>,
  error: undefined as Error | undefined,
}));

vi.mock('@orqafy/db', () => ({
  prisma: {
    document: { findUnique: () => Promise.resolve(doc.row) },
  },
}));
// Mocked like the other `@/server/*` deps below — `writeAudit` itself is
// unit-tested in server/audit.test.ts; here we only assert the ROUTE calls it
// with the right shape, on the right branch, and never lets its failure
// break the download.
vi.mock('@/server/audit', () => ({
  writeAudit: (
    _prisma: unknown,
    input: Record<string, unknown>,
  ): Promise<void> => {
    if (audit.error !== undefined) return Promise.reject(audit.error);
    audit.writes.push(input);
    return Promise.resolve();
  },
}));
// The route resolves the caller via resolveRequestUserId (audit H-2 — the
// isActive-aware bearer/cookie path), not auth() directly. Mock that module.
vi.mock('@/server/request-auth', () => ({
  resolveRequestUserId: (): Promise<string | null> => Promise.resolve('u1'),
}));
const perms = vi.hoisted(() => ({ set: new Set(['view_finances']) }));
vi.mock('@/server/permissions', () => ({
  resolveUserPermissions: () => Promise.resolve(perms.set),
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

describe('GET /api/media/[id] — access audit log (DPA W10)', () => {
  beforeEach(() => {
    audit.writes = [];
    audit.error = undefined;
    perms.set = new Set(['view_finances']);
  });

  it('writes one document.download row on a successful download', async () => {
    doc.row = { id: 'd3', name: 'contract.pdf', mimeType: 'application/pdf', isSPI: false };
    const res = await GET(new Request('http://localhost/api/media/d3'), {
      params: Promise.resolve({ id: 'd3' }),
    });
    expect(res.status).toBe(200);
    expect(audit.writes).toHaveLength(1);
    expect(audit.writes[0]).toMatchObject({
      userId: 'u1',
      action: 'document.download',
      targetType: 'document',
      targetId: 'd3',
      metadata: { isSPI: false },
    });
  });

  it('carries isSPI:true in the metadata for an SPI document download', async () => {
    doc.row = { id: 'd4', name: 'payroll.pdf', mimeType: 'application/pdf', isSPI: true };
    await GET(new Request('http://localhost/api/media/d4'), { params: Promise.resolve({ id: 'd4' }) });
    expect(audit.writes[0]).toMatchObject({ metadata: { isSPI: true } });
  });

  it('writes nothing on a 404 (document not found)', async () => {
    doc.row = null;
    const res = await GET(new Request('http://localhost/api/media/missing'), {
      params: Promise.resolve({ id: 'missing' }),
    });
    expect(res.status).toBe(404);
    expect(audit.writes).toHaveLength(0);
  });

  it('still serves the download when the audit write throws (fail-open on audit, never on bytes)', async () => {
    doc.row = { id: 'd5', name: 'contract.pdf', mimeType: 'application/pdf', isSPI: false };
    audit.error = new Error('db down');
    const res = await GET(new Request('http://localhost/api/media/d5'), {
      params: Promise.resolve({ id: 'd5' }),
    });
    expect(res.status).toBe(200);
    expect(audit.writes).toHaveLength(0);
  });

  it('writes nothing on a 403 (SPI document, caller lacks view_finances)', async () => {
    doc.row = { id: 'd6', name: 'payroll.pdf', mimeType: 'application/pdf', isSPI: true };
    perms.set = new Set();
    const res = await GET(new Request('http://localhost/api/media/d6'), {
      params: Promise.resolve({ id: 'd6' }),
    });
    expect(res.status).toBe(403);
    expect(audit.writes).toHaveLength(0);
  });
});
