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
  } = {},
): Harness {
  const puts: string[] = [];
  const deps: PhotoUploadDeps = {
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
