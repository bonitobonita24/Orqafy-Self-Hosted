// documents.create must only commit rows for keys /api/media actually produces
// (`documents/<uuid>/<name>`). Otherwise a manage_files holder could register a
// Document pointing at a site photo (D-28) — or any other object — and download
// it through /api/media/[id], bypassing the photo assignee rule.
import { describe, expect, it, vi } from 'vitest';
import type { Session } from 'next-auth';
import type { Permission } from '@orqafy/shared';
import { createCallerFactory } from '../trpc';
import type { TRPCContext } from '../context';

// Storage + queue singletons are replaced so no MinIO / Valkey is touched.
const storage = vi.hoisted(() => ({ exists: true }));
vi.mock('../storage', () => ({
  getStorageAdapter: () => ({ objectExists: () => Promise.resolve(storage.exists) }),
}));
vi.mock('../queues', () => ({ enqueueOcr: () => Promise.resolve() }));

const { documentsRouter } = await import('./documents');

type CallerOpts = {
  /** A Document row already referencing the key (found by the pre-check). */
  existing?: { id: string } | null;
  /** Error thrown by document.create (e.g. a P2002 from a concurrent commit). */
  createError?: Error;
};

function caller(opts: CallerOpts = {}) {
  let created = 0;
  const prisma = {
    document: {
      findFirst: () => Promise.resolve(opts.existing ?? null),
      create: ({ data }: { data: Record<string, unknown> }) => {
        if (opts.createError !== undefined) return Promise.reject(opts.createError);
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

// ORQ-26: a storageKey may back at most ONE Document. Otherwise a manage_files
// holder who learns an SPI document's key could commit a second row for the
// same object with isSPI:false and download it via /api/media/[id] without
// view_finances.
describe('documents.create one Document per storageKey (ORQ-26)', () => {
  const key = 'documents/3f2c9a4e-8b1d-4c7a-9e2f-1a2b3c4d5e6f/payroll.pdf';

  it('rejects re-committing a key an existing Document already uses', async () => {
    storage.exists = true;
    const { c, count } = caller({ existing: { id: 'spi-doc-secret-id' } });
    const err = await c.create({ ...base, storageKey: key, isSPI: false }).catch((e: unknown) => e);
    expect(err).toMatchObject({ code: 'CONFLICT' });
    // The message must not leak anything about the other document.
    expect(String((err as Error).message)).not.toContain('spi-doc-secret-id');
    expect(count()).toBe(0);
  });

  it('maps a concurrent-commit unique violation (P2002) to CONFLICT', async () => {
    storage.exists = true;
    const p2002 = Object.assign(new Error('Unique constraint failed on storageKey'), {
      code: 'P2002',
    });
    const { c } = caller({ createError: p2002 });
    const err = await c.create({ ...base, storageKey: key }).catch((e: unknown) => e);
    expect(err).toMatchObject({ code: 'CONFLICT' });
    expect(String((err as Error).message)).not.toContain('storageKey');
  });

  it('rethrows non-unique create errors unchanged', async () => {
    storage.exists = true;
    const { c } = caller({ createError: new Error('db down') });
    await expect(c.create({ ...base, storageKey: key })).rejects.toMatchObject({
      code: 'INTERNAL_SERVER_ERROR',
    });
  });

  it('rejects a key whose object is not in storage', async () => {
    storage.exists = false;
    const { c, count } = caller();
    await expect(c.create({ ...base, storageKey: key })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    expect(count()).toBe(0);
  });

  it('accepts a fresh, uploaded key', async () => {
    storage.exists = true;
    const { c, count } = caller();
    await expect(c.create({ ...base, storageKey: key })).resolves.toMatchObject({
      storageKey: key,
      isSPI: false,
    });
    expect(count()).toBe(1);
  });
});
