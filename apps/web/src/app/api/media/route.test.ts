// Regression tests for the document UPLOAD route's denylist→allowlist switch
// (audit M-5). The allowlist requires BOTH the extension AND the declared
// MIME type to be recognized — this is what blocks a relabel attack in
// EITHER direction (wrong extension on a real type, or a real extension
// carrying a lying Content-Type).
import { describe, expect, it, vi } from 'vitest';

vi.mock('@orqafy/db', () => ({ prisma: {} }));
vi.mock('@orqafy/storage', () => ({
  buildDocumentKey: (name: string) => `documents/u1/${name}`,
}));
// The route resolves the caller via resolveRequestUserId (audit H-2 — the
// isActive-aware bearer/cookie path), not auth() directly. Mock that module.
vi.mock('@/server/request-auth', () => ({
  resolveRequestUserId: (): Promise<string | null> => Promise.resolve('u1'),
}));
vi.mock('@/server/permissions', () => ({
  resolveUserPermissions: () => Promise.resolve(new Set(['manage_files'])),
}));
vi.mock('@/server/storage', () => ({
  getStorageAdapter: () => ({ putObject: () => Promise.resolve() }),
}));

const { POST, isAllowedUpload } = await import('./route');

describe('isAllowedUpload — allowlist (audit M-5)', () => {
  it('rejects evil.html declared as text/html', () => {
    expect(isAllowedUpload('evil.html', 'text/html')).toBe(false);
  });

  it('rejects evil.svg declared as image/svg+xml', () => {
    expect(isAllowedUpload('evil.svg', 'image/svg+xml')).toBe(false);
  });

  it('rejects evil.html relabeled as image/png (extension gate)', () => {
    expect(isAllowedUpload('evil.html', 'image/png')).toBe(false);
  });

  it('rejects evil.png relabeled as text/html (MIME gate)', () => {
    expect(isAllowedUpload('evil.png', 'text/html')).toBe(false);
  });

  it('accepts a legit photo.png as image/png', () => {
    expect(isAllowedUpload('photo.png', 'image/png')).toBe(true);
  });

  it('accepts a legit report.pdf as application/pdf', () => {
    expect(isAllowedUpload('report.pdf', 'application/pdf')).toBe(true);
  });
});

function uploadRequest(name: string, type: string): Request {
  const form = new FormData();
  form.set('file', new File([new Uint8Array([1, 2, 3])], name, { type }));
  return new Request('http://localhost/api/media', { method: 'POST', body: form });
}

describe('POST /api/media — upload allowlist enforcement (audit M-5)', () => {
  it('400s an evil.html upload declared as text/html', async () => {
    const res = await POST(uploadRequest('evil.html', 'text/html'));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'This file type is not allowed.' });
  });

  it('400s a relabeled evil.html declared as image/png', async () => {
    const res = await POST(uploadRequest('evil.html', 'image/png'));
    expect(res.status).toBe(400);
  });

  it('accepts a legit photo.png upload', async () => {
    const res = await POST(uploadRequest('photo.png', 'image/png'));
    expect(res.status).toBe(200);
    expect((await res.json()).mimeType).toBe('image/png');
  });
});
