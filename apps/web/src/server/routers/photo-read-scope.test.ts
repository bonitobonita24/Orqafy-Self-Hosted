// F2: photo rows (GPS, clientId, storageKey) must not reach every authenticated
// user. tasks.byId returns photos only to the assignee or an oversight holder,
// and never the clientId/storageKey; dashboard.summary's recent-photo feed is
// oversight-only and carries no storageKey/clientId.
import { describe, expect, it } from 'vitest';
import type { Session } from 'next-auth';
import type { Permission } from '@orqafy/shared';
import { createCallerFactory } from '../trpc';
import type { TRPCContext } from '../context';
import { tasksRouter } from './tasks';
import { dashboardRouter } from './dashboard';

const TASK = {
  id: 't1',
  title: 'Pour slab',
  assigneeId: 'assignee',
  project: { id: 'p1', name: 'Tower' },
  assignee: { id: 'assignee', name: 'Ana' },
};

const PHOTO = {
  id: 'ph1',
  clientId: '3f2c9a4e-8b1d-4c7a-9e2f-1a2b3c4d5e6f',
  storageKey: 'photos/3f2c9a4e-8b1d-4c7a-9e2f-1a2b3c4d5e6f/photo.jpg',
  taskId: 't1',
  capturedBy: 'assignee',
  capturedAt: new Date('2026-09-26T08:00:00Z'),
  gpsLat: 13.4,
  gpsLng: 121.18,
};

/** Applies a Prisma `select` to a row so the test sees exactly what is returned. */
function pick(row: Record<string, unknown>, select: Record<string, boolean> | undefined) {
  if (select === undefined) return row;
  return Object.fromEntries(Object.keys(select).filter((k) => select[k]).map((k) => [k, row[k]]));
}

function makeCtx(userId: string, permissions: Permission[]) {
  const photoQueries: unknown[] = [];
  const prisma = {
    task: {
      findUnique: () => Promise.resolve({ ...TASK }),
      findMany: () => Promise.resolve([]),
    },
    photo: {
      findMany: (args: { select?: Record<string, boolean> }) => {
        photoQueries.push(args);
        return Promise.resolve([pick(PHOTO, args.select)]);
      },
    },
    project: { findMany: () => Promise.resolve([]) },
    documentReview: { count: () => Promise.resolve(0) },
    leaveRequest: { count: () => Promise.resolve(0) },
  };
  const ctx = {
    prisma: prisma as unknown as TRPCContext['prisma'],
    session: { user: { id: userId }, expires: '2099-01-01T00:00:00.000Z' } as Session,
    userId,
    permissions: new Set<Permission>(permissions),
  } satisfies TRPCContext;
  return { ctx, photoQueries };
}

describe('tasks.byId photo scoping', () => {
  it('returns photos to the assignee, without clientId/storageKey', async () => {
    const { ctx } = makeCtx('assignee', ['upload_photo']);
    const task = await createCallerFactory(tasksRouter)(ctx).byId({ id: 't1' });
    expect(task?.photos).toHaveLength(1);
    const photo = task?.photos[0] as Record<string, unknown>;
    expect(photo.id).toBe('ph1');
    expect(photo).not.toHaveProperty('clientId');
    expect(photo).not.toHaveProperty('storageKey');
  });

  it('returns photos to an oversight holder who is not the assignee', async () => {
    const { ctx } = makeCtx('pm', ['create_project']);
    const task = await createCallerFactory(tasksRouter)(ctx).byId({ id: 't1' });
    expect(task?.photos).toHaveLength(1);
  });

  it('returns NO photos (and never queries them) for field staff who is not the assignee', async () => {
    const { ctx, photoQueries } = makeCtx('other', ['upload_photo']);
    const task = await createCallerFactory(tasksRouter)(ctx).byId({ id: 't1' });
    expect(task?.title).toBe('Pour slab');
    expect(task?.photos).toEqual([]);
    expect(photoQueries).toHaveLength(0);
  });

  it('returns NO photos for the client role', async () => {
    const { ctx } = makeCtx('client', []);
    const task = await createCallerFactory(tasksRouter)(ctx).byId({ id: 't1' });
    expect(task?.photos).toEqual([]);
  });
});

describe('dashboard.summary recent photos', () => {
  it('is empty (and never queried) without an oversight atom', async () => {
    const { ctx, photoQueries } = makeCtx('field', ['upload_photo']);
    const summary = await createCallerFactory(dashboardRouter)(ctx).summary();
    expect(summary.recentPhotos).toEqual([]);
    expect(photoQueries).toHaveLength(0);
  });

  it('is returned to oversight holders without storageKey/clientId/GPS', async () => {
    const { ctx } = makeCtx('boss', ['view_all_projects']);
    const summary = await createCallerFactory(dashboardRouter)(ctx).summary();
    expect(summary.recentPhotos).toHaveLength(1);
    const photo = summary.recentPhotos[0] as Record<string, unknown>;
    expect(photo).not.toHaveProperty('storageKey');
    expect(photo).not.toHaveProperty('clientId');
    expect(photo).not.toHaveProperty('gpsLat');
  });
});
