// TDD for the GET /api/photos/[id] handler (ORQ-32). The handler takes its I/O
// (auth, Prisma read, permissions, object storage) as injected deps so the
// authorization + no-existence-oracle rules are pinned without a DB or MinIO.
//
// Photo rows carry GPS, so the allow/deny matrix is the security surface: the
// download must be scoped exactly like the tasks.byId metadata read (assignee OR
// oversight for task photos; oversight-only for milestone/orphan photos), and a
// missing photo must be byte-identical to a denied one (no existence leak).
import { describe, expect, it } from 'vitest';
import { ObjectNotFoundError } from '@orqafy/storage';
import type { Permission } from '@orqafy/shared';
import { SYSTEM_ROLE_PERMISSIONS } from './roles';
import {
  handlePhotoDownload,
  type PhotoDownloadDeps,
  type StoredPhoto,
} from './photo-download';

const KEY = 'photos/3f2c9a4e-8b1d-4c7a-9e2f-1a2b3c4d5e6f/photo.jpg';
const BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);

function taskPhoto(overrides: Partial<StoredPhoto> = {}): StoredPhoto {
  return {
    id: 'p1',
    storageKey: KEY,
    taskId: 't1',
    task: { assigneeId: 'assignee' },
    ...overrides,
  };
}

function deps(opts: {
  userId?: string | null;
  photo?: StoredPhoto | null;
  permissions?: readonly Permission[];
  getObject?: PhotoDownloadDeps['getObject'];
} = {}): PhotoDownloadDeps {
  return {
    resolveUserId: () => Promise.resolve(opts.userId === undefined ? 'assignee' : opts.userId),
    findPhoto: () => Promise.resolve(opts.photo === undefined ? taskPhoto() : opts.photo),
    resolvePermissions: () => Promise.resolve(new Set(opts.permissions ?? [])),
    getObject:
      opts.getObject ??
      (() => Promise.resolve({ body: BYTES, size: BYTES.byteLength })),
  };
}

const req = new Request('http://localhost/api/photos/p1');
const call = (d: PhotoDownloadDeps) => handlePhotoDownload(d, { photoId: 'p1', req });

describe('handlePhotoDownload — allow (200)', () => {
  it('serves bytes to the task assignee (field_staff, no oversight atom)', async () => {
    const res = await call(
      deps({ userId: 'assignee', permissions: SYSTEM_ROLE_PERMISSIONS.field_staff }),
    );
    expect(res.status).toBe(200);
    if (res.status !== 200) throw new Error('unreachable');
    expect(res.body).toBe(BYTES);
    expect(res.contentType).toBe('image/jpeg');
    expect(res.size).toBe(BYTES.byteLength);
    expect(res.filename).toBe('photo-p1');
    expect(res.ext).toBe('jpg');
  });

  it('serves bytes to owner_admin who is NOT the assignee (oversight)', async () => {
    const res = await call(
      deps({ userId: 'boss', permissions: SYSTEM_ROLE_PERMISSIONS.owner_admin }),
    );
    expect(res.status).toBe(200);
  });

  it('serves bytes to project_manager (non-assignee, has view_all_projects)', async () => {
    const res = await call(deps({ userId: 'pm', permissions: SYSTEM_ROLE_PERMISSIONS.project_manager }));
    expect(res.status).toBe(200);
  });

  it('serves an oversight user a milestone-only (taskless) photo', async () => {
    const res = await call(
      deps({
        userId: 'boss',
        photo: taskPhoto({ taskId: null, task: null }),
        permissions: SYSTEM_ROLE_PERMISSIONS.owner_admin,
      }),
    );
    expect(res.status).toBe(200);
  });
});

describe('handlePhotoDownload — deny (uniform 404)', () => {
  it('404 for a non-assignee field_staff', async () => {
    const res = await call(deps({ userId: 'stranger', permissions: SYSTEM_ROLE_PERMISSIONS.field_staff }));
    expect(res).toEqual({ status: 404, message: 'Not found.' });
  });

  it('404 for the client role', async () => {
    const res = await call(deps({ userId: 'c', permissions: SYSTEM_ROLE_PERMISSIONS.client }));
    expect(res).toEqual({ status: 404, message: 'Not found.' });
  });

  it('404 for the accountant (no oversight atom)', async () => {
    const res = await call(deps({ userId: 'acct', permissions: SYSTEM_ROLE_PERMISSIONS.accountant }));
    expect(res).toEqual({ status: 404, message: 'Not found.' });
  });

  it('404 for a non-oversight user on a milestone-only photo', async () => {
    const res = await call(
      deps({
        userId: 'assignee',
        photo: taskPhoto({ taskId: null, task: null }),
        permissions: SYSTEM_ROLE_PERMISSIONS.field_staff,
      }),
    );
    expect(res).toEqual({ status: 404, message: 'Not found.' });
  });

  it('missing photo → 404, byte-identical to the denied case (no existence oracle)', async () => {
    const missing = await call(deps({ userId: 'assignee', photo: null }));
    const denied = await call(
      deps({ userId: 'stranger', permissions: SYSTEM_ROLE_PERMISSIONS.field_staff }),
    );
    expect(missing).toEqual({ status: 404, message: 'Not found.' });
    expect(missing).toEqual(denied);
  });

  it('missing bytes (ObjectNotFoundError) → the same uniform 404', async () => {
    const res = await call(
      deps({
        userId: 'assignee',
        permissions: SYSTEM_ROLE_PERMISSIONS.field_staff,
        getObject: () => Promise.reject(new ObjectNotFoundError(KEY)),
      }),
    );
    expect(res).toEqual({ status: 404, message: 'Not found.' });
  });
});

describe('handlePhotoDownload — errors', () => {
  it('401 when unauthenticated (never reveals whether the photo exists)', async () => {
    const res = await call(deps({ userId: null }));
    expect(res.status).toBe(401);
  });

  it('500 on an unexpected storage error (not ObjectNotFoundError)', async () => {
    const res = await call(
      deps({
        userId: 'assignee',
        permissions: SYSTEM_ROLE_PERMISSIONS.field_staff,
        getObject: () => Promise.reject(new Error('S3 down')),
      }),
    );
    expect(res.status).toBe(500);
  });

  it('derives the content type + extension from the stored key, not the client', async () => {
    const png = await call(
      deps({
        userId: 'assignee',
        photo: taskPhoto({ storageKey: 'photos/3f2c9a4e-8b1d-4c7a-9e2f-1a2b3c4d5e6f/photo.png' }),
        permissions: SYSTEM_ROLE_PERMISSIONS.field_staff,
      }),
    );
    expect(png.status).toBe(200);
    if (png.status !== 200) throw new Error('unreachable');
    expect(png.contentType).toBe('image/png');
    expect(png.ext).toBe('png');
  });
});
