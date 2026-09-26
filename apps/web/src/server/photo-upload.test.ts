// TDD for the POST /api/photos handler (D-28, ORQ-23). The handler takes its
// I/O (auth, permissions, Prisma reads, object storage) as injected deps so the
// authorization + immutability rules are pinned without a DB or MinIO.
import { describe, expect, it } from 'vitest';
import type { Permission } from '@orqafy/shared';
import { PHOTO_FORBIDDEN_MESSAGE } from './photo-policy';
import { handlePhotoUpload, type PhotoUploadDeps } from './photo-upload';

const CLIENT_ID = '3f2c9a4e-8b1d-4c7a-9e2f-1a2b3c4d5e6f';
const KEY = `photos/${CLIENT_ID}/photo.jpg`;

interface Harness {
  deps: PhotoUploadDeps;
  puts: string[];
}

function harness(
  opts: {
    userId?: string | null;
    permissions?: Permission[];
    tasks?: Record<string, { assigneeId: string | null }>;
    photos?: Record<string, { capturedBy: string; storageKey: string }>;
    rateLimit?: PhotoUploadDeps['rateLimit'];
  } = {},
): Harness {
  const puts: string[] = [];
  const deps: PhotoUploadDeps = {
    rateLimit: opts.rateLimit ?? (() => Promise.resolve({ allowed: true, retryAfterSec: 0 })),
    resolveUserId: () => Promise.resolve(opts.userId === undefined ? 'u1' : opts.userId),
    resolvePermissions: () => Promise.resolve(new Set(opts.permissions ?? ['upload_photo'])),
    findTask: (id) => Promise.resolve((opts.tasks ?? { mine: { assigneeId: 'u1' } })[id] ?? null),
    findPhotoByClientId: (clientId) => Promise.resolve(opts.photos?.[clientId] ?? null),
    putObject: ({ key }) => {
      puts.push(key);
      return Promise.resolve();
    },
  };
  return { deps, puts };
}

function uploadRequest(fields: { taskId?: string; clientId?: string } = {}): Request {
  const form = new FormData();
  form.set('file', new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], 'x.jpg', { type: 'image/jpeg' }));
  form.set('taskId', fields.taskId ?? 'mine');
  form.set('clientId', fields.clientId ?? CLIENT_ID);
  return new Request('http://localhost/api/photos', { method: 'POST', body: form });
}

/** Materialize the multipart body so the request carries a real Content-Length. */

async function withLength(req: Request): Promise<Request> {
  const body = new Uint8Array(await req.arrayBuffer());
  const headers = new Headers(req.headers);
  headers.set('content-length', String(body.byteLength));
  return new Request('http://localhost/api/photos', { method: 'POST', headers, body });
}

describe('handlePhotoUpload — clientId ownership (F1)', () => {
  it('uploads a fresh clientId for the assignee', async () => {
    const h = harness();
    const res = await handlePhotoUpload(await withLength(uploadRequest()), h.deps);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ storageKey: KEY });
    expect(h.puts).toEqual([KEY]);
  });

  it('403 (uniform message) when the clientId is committed by ANOTHER user — no overwrite', async () => {
    const h = harness({ photos: { [CLIENT_ID]: { capturedBy: 'u2', storageKey: KEY } } });
    const res = await handlePhotoUpload(await withLength(uploadRequest()), h.deps);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: PHOTO_FORBIDDEN_MESSAGE });
    expect(h.puts).toEqual([]);
  });

  it('409 + existing storageKey when the caller already committed it — no overwrite', async () => {
    const existingKey = `photos/${CLIENT_ID}/photo.png`;
    const h = harness({ photos: { [CLIENT_ID]: { capturedBy: 'u1', storageKey: existingKey } } });
    const res = await handlePhotoUpload(await withLength(uploadRequest()), h.deps);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'Photo already committed', storageKey: existingKey });
    expect(h.puts).toEqual([]);
  });

  it('matches an upper-case clientId against the lower-case committed row', async () => {
    const h = harness({ photos: { [CLIENT_ID]: { capturedBy: 'u2', storageKey: KEY } } });
    const res = await handlePhotoUpload(
      await withLength(uploadRequest({ clientId: CLIENT_ID.toUpperCase() })),
      h.deps,
    );
    expect(res.status).toBe(403);
    expect(h.puts).toEqual([]);
  });

  it('403 (uniform) for a task not assigned to the caller', async () => {
    const h = harness({ tasks: { mine: { assigneeId: 'u2' } } });
    const res = await handlePhotoUpload(await withLength(uploadRequest()), h.deps);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: PHOTO_FORBIDDEN_MESSAGE });
    expect(h.puts).toEqual([]);
  });

  it('401 when unauthenticated', async () => {
    const h = harness({ userId: null });
    const res = await handlePhotoUpload(await withLength(uploadRequest()), h.deps);
    expect(res.status).toBe(401);
  });

  it('403 without upload_photo', async () => {
    const h = harness({ permissions: ['manage_files'] });
    const res = await handlePhotoUpload(await withLength(uploadRequest()), h.deps);
    expect(res.status).toBe(403);
  });
});

/** A request whose body must never be parsed: formData() is counted. */
function spiedRequest(contentLength: string | null): { req: Request; parsed: () => number } {
  const headers = new Headers({ 'content-type': 'multipart/form-data; boundary=x' });
  if (contentLength !== null) headers.set('content-length', contentLength);
  const req = new Request('http://localhost/api/photos', { method: 'POST', headers });
  let calls = 0;
  Object.defineProperty(req, 'formData', {
    value: () => {
      calls++;
      return Promise.reject(new Error('body must not be buffered'));
    },
  });
  return { req, parsed: () => calls };
}

describe('handlePhotoUpload — Content-Length gate (F3)', () => {
  it('411 when Content-Length is missing, before buffering the body', async () => {
    const { req, parsed } = spiedRequest(null);
    const res = await handlePhotoUpload(req, harness().deps);
    expect(res.status).toBe(411);
    expect(await res.json()).toEqual({ error: 'Content-Length required.' });
    expect(parsed()).toBe(0);
  });

  it.each(['abc', '', '-5', '1.5', 'Infinity', '12abc'])(
    '411 for an invalid Content-Length %j, before buffering',
    async (value) => {
      const { req, parsed } = spiedRequest(value);
      const res = await handlePhotoUpload(req, harness().deps);
      expect(res.status).toBe(411);
      expect(parsed()).toBe(0);
    },
  );

  it('413 when Content-Length exceeds 15 MiB + 1 MiB envelope, before buffering', async () => {
    const { req, parsed } = spiedRequest(String(16 * 1024 * 1024 + 1));
    const res = await handlePhotoUpload(req, harness().deps);
    expect(res.status).toBe(413);
    expect(parsed()).toBe(0);
  });

  it('accepts exactly 15 MiB + 1 MiB (reaches body parsing)', async () => {
    const { req, parsed } = spiedRequest(String(16 * 1024 * 1024));
    const res = await handlePhotoUpload(req, harness().deps);
    expect(parsed()).toBe(1);
    expect(res.status).toBe(400);
  });
});

describe('handlePhotoUpload — per-user rate limit (F3)', () => {
  it('429 + Retry-After when the limiter refuses, before buffering', async () => {
    const seen: string[] = [];
    const h = harness({
      rateLimit: (userId) => {
        seen.push(userId);
        return Promise.resolve({ allowed: false, retryAfterSec: 600 });
      },
    });
    const { req, parsed } = spiedRequest('1000');
    const res = await handlePhotoUpload(req, h.deps);
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('600');
    expect(await res.json()).toEqual({ error: 'Too many uploads. Try again later.' });
    expect(seen).toEqual(['u1']);
    expect(parsed()).toBe(0);
  });

  it('does not consume the limiter for an unauthenticated request', async () => {
    let calls = 0;
    const h = harness({
      userId: null,
      rateLimit: () => {
        calls++;
        return Promise.resolve({ allowed: true, retryAfterSec: 0 });
      },
    });
    const res = await handlePhotoUpload(spiedRequest('1000').req, h.deps);
    expect(res.status).toBe(401);
    expect(calls).toBe(0);
  });
});
