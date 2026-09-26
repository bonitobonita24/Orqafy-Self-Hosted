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

/** Minimal in-memory Prisma: tasks keyed by id, photos upserted by clientId. */
function fakePrisma(tasks: Record<string, { id: string; assigneeId: string | null }>) {
  const photos = new Map<string, FakePhoto>();
  let seq = 0;
  const prisma = {
    task: {
      findUnique: ({ where }: { where: { id: string } }) =>
        Promise.resolve(tasks[where.id] ?? null),
    },
    photo: {
      upsert: ({
        where,
        create,
      }: {
        where: { clientId: string };
        create: Omit<FakePhoto, 'id'>;
        update: Record<string, unknown>;
      }) => {
        const existing = photos.get(where.clientId);
        if (existing !== undefined) return Promise.resolve(existing);
        const row: FakePhoto = { id: `p${++seq}`, ...create };
        photos.set(where.clientId, row);
        return Promise.resolve(row);
      },
    },
  };
  return { prisma, photos };
}

function makeCaller(
  userId: string,
  permissions: Permission[],
  tasks: Record<string, { id: string; assigneeId: string | null }>,
) {
  const { prisma, photos } = fakePrisma(tasks);
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
});
