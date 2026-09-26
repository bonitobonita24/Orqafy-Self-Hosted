// TDD for the photos router (D-28). Drives the real procedures (incl. the
// permissionProcedure guard) through a tRPC caller with an in-memory Prisma
// stand-in, so the authorization + idempotency rules are pinned without a DB.
import { describe, expect, it } from 'vitest';
import type { Session } from 'next-auth';
import type { Permission } from '@orqafy/shared';
import { createCallerFactory } from '../trpc';
import type { TRPCContext } from '../context';
import { PHOTO_FORBIDDEN_MESSAGE } from '../photo-policy';
import { photosRouter } from './photos';

const CLIENT_ID = '3f2c9a4e-8b1d-4c7a-9e2f-1a2b3c4d5e6f';
const OTHER_CLIENT_ID = '11111111-2222-4333-8444-555555555555';

interface FakePhoto {
  id: string;
  clientId: string | null;
  storageKey: string;
  taskId: string | null;
  capturedBy: string;
  capturedAt: Date;
  gpsLat: number | null;
  gpsLng: number | null;
}

type FakeOpts = { seed?: FakePhoto[]; raceRow?: FakePhoto };

function uniqueViolation(): Error {
  return Object.assign(new Error('Unique constraint failed on clientId'), { code: 'P2002' });
}

/**
 * Minimal in-memory Prisma: tasks keyed by id, photos keyed by clientId.
 * `raceRow` simulates a concurrent commit: findUnique misses, then create hits
 * the unique constraint (P2002) because another request inserted `raceRow`
 * in between.
 */
function fakePrisma(
  tasks: Record<string, { id: string; assigneeId: string | null }>,
  opts: FakeOpts = {},
) {
  const photos = new Map<string, FakePhoto>();
  for (const row of opts.seed ?? []) photos.set(row.clientId ?? row.id, row);
  let raced = false;
  let seq = 0;
  const prisma = {
    task: {
      findUnique: ({ where }: { where: { id: string } }) =>
        Promise.resolve(tasks[where.id] ?? null),
    },
    photo: {
      findUnique: ({ where }: { where: { clientId: string } }) =>
        Promise.resolve(photos.get(where.clientId) ?? null),
      create: ({ data }: { data: Omit<FakePhoto, 'id'> }) => {
        if (opts.raceRow !== undefined && !raced) {
          raced = true;
          photos.set(opts.raceRow.clientId ?? opts.raceRow.id, opts.raceRow);
          return Promise.reject(uniqueViolation());
        }
        if (data.clientId !== null && photos.has(data.clientId)) {
          return Promise.reject(uniqueViolation());
        }
        const row: FakePhoto = { id: `p${++seq}`, ...data };
        photos.set(data.clientId ?? row.id, row);
        return Promise.resolve(row);
      },
    },
  };
  return { prisma, photos };
}

function existingRow(capturedBy: string): FakePhoto {
  return {
    id: 'existing',
    clientId: CLIENT_ID,
    storageKey: `photos/${CLIENT_ID}/photo.jpg`,
    taskId: 'mine',
    capturedBy,
    capturedAt: new Date('2026-09-25T08:00:00Z'),
    gpsLat: 13.4,
    gpsLng: 121.18,
  };
}

function makeCaller(
  userId: string,
  permissions: Permission[],
  tasks: Record<string, { id: string; assigneeId: string | null }>,
  opts: FakeOpts = {},
) {
  const { prisma, photos } = fakePrisma(tasks, opts);
  const ctx = {
    prisma: prisma as unknown as TRPCContext['prisma'],
    session: { user: { id: userId }, expires: '2099-01-01T00:00:00.000Z' } as Session,
    userId,
    permissions: new Set<Permission>(permissions),
  } satisfies TRPCContext;
  const caller = createCallerFactory(photosRouter)(ctx);
  return { caller, photos };
}

const TASKS = {
  mine: { id: 'mine', assigneeId: 'u1' },
  theirs: { id: 'theirs', assigneeId: 'u2' },
};

function input(overrides: Record<string, unknown> = {}) {
  return {
    clientId: CLIENT_ID,
    taskId: 'mine',
    storageKey: `photos/${CLIENT_ID}/photo.jpg`,
    capturedAt: new Date('2026-09-26T08:00:00Z'),
    ...overrides,
  };
}

describe('photos.create', () => {
  it('creates a row for the assignee with capturedBy = caller', async () => {
    const { caller } = makeCaller('u1', ['upload_photo'], TASKS);
    const row = await caller.create(input({ gpsLat: 13.4, gpsLng: 121.18 }));
    expect(row.capturedBy).toBe('u1');
    expect(row.taskId).toBe('mine');
    expect(row.storageKey).toBe(`photos/${CLIENT_ID}/photo.jpg`);
    expect(row.gpsLat).toBe(13.4);
  });

  it('FORBIDDEN for a user who is not the assignee', async () => {
    const { caller } = makeCaller('u1', ['upload_photo'], TASKS);
    await expect(caller.create(input({ taskId: 'theirs' }))).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: PHOTO_FORBIDDEN_MESSAGE,
    });
  });

  it('FORBIDDEN with the SAME message for a missing task (no existence leak)', async () => {
    const { caller } = makeCaller('u1', ['upload_photo'], TASKS);
    await expect(caller.create(input({ taskId: 'nope' }))).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: PHOTO_FORBIDDEN_MESSAGE,
    });
  });

  it('FORBIDDEN without the upload_photo permission', async () => {
    const { caller } = makeCaller('u1', ['manage_files'], TASKS);
    await expect(caller.create(input())).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('rejects a storageKey belonging to another clientId', async () => {
    const { caller, photos } = makeCaller('u1', ['upload_photo'], TASKS);
    await expect(
      caller.create(input({ storageKey: `photos/${OTHER_CLIENT_ID}/photo.jpg` })),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(photos.size).toBe(0);
  });

  it('rejects a storageKey outside the photos namespace', async () => {
    const { caller } = makeCaller('u1', ['upload_photo'], TASKS);
    await expect(
      caller.create(input({ storageKey: `documents/${CLIENT_ID}/secret.pdf` })),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('rejects a non-UUID clientId at input validation', async () => {
    const { caller } = makeCaller('u1', ['upload_photo'], TASKS);
    await expect(
      caller.create(input({ clientId: '../x', storageKey: 'photos/../x/photo.jpg' })),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('rejects out-of-range GPS', async () => {
    const { caller } = makeCaller('u1', ['upload_photo'], TASKS);
    await expect(caller.create(input({ gpsLat: 91 }))).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    await expect(caller.create(input({ gpsLng: -181 }))).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('a retry with the same clientId returns the same single row', async () => {
    const { caller, photos } = makeCaller('u1', ['upload_photo'], TASKS);
    const first = await caller.create(input());
    const second = await caller.create(input());
    expect(second.id).toBe(first.id);
    expect(photos.size).toBe(1);
  });

  it('an upper-case clientId maps to the same row as its lower-case form', async () => {
    const { caller, photos } = makeCaller('u1', ['upload_photo'], TASKS);
    await caller.create(input());
    await caller.create(input({ clientId: CLIENT_ID.toUpperCase() }));
    expect(photos.size).toBe(1);
  });

  it('FORBIDDEN when the clientId was already committed by ANOTHER user (no row leak)', async () => {
    const { caller, photos } = makeCaller('u1', ['upload_photo'], TASKS, {
      seed: [existingRow('u2')],
    });
    await expect(caller.create(input())).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: PHOTO_FORBIDDEN_MESSAGE,
    });
    expect(photos.get(CLIENT_ID)?.capturedBy).toBe('u2');
  });

  it('returns the existing row unchanged when the caller already committed it', async () => {
    const { caller } = makeCaller('u1', ['upload_photo'], TASKS, { seed: [existingRow('u1')] });
    const row = await caller.create(input({ gpsLat: 1, gpsLng: 2 }));
    expect(row.id).toBe('existing');
    expect(row.gpsLat).toBe(13.4);
  });

  it('P2002 race: returns the concurrently-committed row when it is the caller’s', async () => {
    const { caller } = makeCaller('u1', ['upload_photo'], TASKS, { raceRow: existingRow('u1') });
    const row = await caller.create(input());
    expect(row.id).toBe('existing');
  });

  it('P2002 race: FORBIDDEN when the concurrently-committed row is another user’s', async () => {
    const { caller } = makeCaller('u1', ['upload_photo'], TASKS, { raceRow: existingRow('u2') });
    await expect(caller.create(input())).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: PHOTO_FORBIDDEN_MESSAGE,
    });
  });
});
