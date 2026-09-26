// documents.create must only commit rows for keys /api/media actually produces
// (`documents/<uuid>/<name>`). Otherwise a manage_files holder could register a
// Document pointing at a site photo (D-28) — or any other object — and download
// it through /api/media/[id], bypassing the photo assignee rule.
import { describe, expect, it } from 'vitest';
import type { Session } from 'next-auth';
import type { Permission } from '@orqafy/shared';
import { createCallerFactory } from '../trpc';
import type { TRPCContext } from '../context';
import { documentsRouter } from './documents';

function caller() {
  let created = 0;
  const prisma = {
    document: {
      create: ({ data }: { data: Record<string, unknown> }) => {
        created++;
        return Promise.resolve({ id: 'd1', ...data });
      },
    },
  };
  const ctx = {
    prisma: prisma as unknown as TRPCContext['prisma'],
    session: { user: { id: 'u1' }, expires: '2099-01-01T00:00:00.000Z' } as Session,
    userId: 'u1',
    permissions: new Set<Permission>(['manage_files']),
  } satisfies TRPCContext;
  return { c: createCallerFactory(documentsRouter)(ctx), count: () => created };
}

const base = { name: 'x.jpg', category: 'other' as const, size: 10, mimeType: 'image/jpeg' };

describe('documents.create storageKey guard', () => {
  it('rejects a site-photo key', async () => {
    const { c, count } = caller();
    await expect(
      c.create({ ...base, storageKey: 'photos/3f2c9a4e-8b1d-4c7a-9e2f-1a2b3c4d5e6f/photo.jpg' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(count()).toBe(0);
  });

  it('rejects a traversal key', async () => {
    const { c } = caller();
    await expect(
      c.create({ ...base, storageKey: 'documents/3f2c9a4e-8b1d-4c7a-9e2f-1a2b3c4d5e6f/../x' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});
