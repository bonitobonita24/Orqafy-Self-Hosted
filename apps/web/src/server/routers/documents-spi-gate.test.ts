// Audit H-1: SPI documents (payroll/HR) must be fully gated behind
// `view_finances` — not just on `list`/`byId`. A `manage_files` holder without
// `view_finances` (e.g. project_manager) must not be able to read, flip
// `isSPI` on, or delete an SPI document, and the review tray must exclude SPI
// rows for them.
import { describe, expect, it, vi } from 'vitest';
import type { Session } from 'next-auth';
import type { Permission } from '@orqafy/shared';
import { createCallerFactory } from '../trpc';
import type { TRPCContext } from '../context';

vi.mock('../storage', () => ({
  getStorageAdapter: () => ({
    objectExists: () => Promise.resolve(true),
    deleteObject: () => Promise.resolve(),
  }),
}));
vi.mock('../queues', () => ({ enqueueOcr: () => Promise.resolve() }));

const { documentsRouter } = await import('./documents');

const SPI_DOC = {
  id: 'spi-1',
  name: 'payroll.pdf',
  storageKey: 'documents/x/payroll.pdf',
  isSPI: true,
  ocrText: 'ssn-secret',
  category: 'other' as const,
  mimeType: 'application/pdf',
  size: 10,
  uploadedBy: 'u1',
};

const NON_SPI_DOC = { ...SPI_DOC, id: 'doc-1', isSPI: false };

type ReviewFixture = { id: string; fileId: string; file: { isSPI: boolean } };

/** Applies a Prisma `select` to a row so the test sees exactly what is returned. */
function pick(row: Record<string, unknown>, select: Record<string, boolean> | undefined) {
  if (select === undefined) return row;
  return Object.fromEntries(Object.keys(select).filter((k) => select[k]).map((k) => [k, row[k]]));
}

function caller(opts: {
  permissions: Permission[];
  doc?: Record<string, unknown> | null;
  review?: ReviewFixture | null;
}) {
  let updated: Record<string, unknown> | null = null;
  let deleted = false;
  let reviewWhere: unknown;
  const prisma = {
    document: {
      findUnique: ({ select }: { select?: Record<string, boolean> } = {}) =>
        Promise.resolve(opts.doc === null || opts.doc === undefined ? null : pick(opts.doc, select)),
      update: ({ data, select }: { data: Record<string, unknown>; select?: Record<string, boolean> }) => {
        updated = data;
        return Promise.resolve(pick({ ...(opts.doc ?? {}), ...data }, select));
      },
      delete: () => {
        deleted = true;
        return Promise.resolve({ id: (opts.doc as { id: string } | undefined)?.id });
      },
    },
    documentReview: {
      findUnique: () => Promise.resolve(opts.review ?? null),
      update: ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: opts.review?.id, ...data }),
      findMany: (args: { where?: unknown }) => {
        reviewWhere = args.where;
        return Promise.resolve([]);
      },
    },
  };
  const ctx = {
    prisma: prisma as unknown as TRPCContext['prisma'],
    session: { user: { id: 'u1' }, expires: '2099-01-01T00:00:00.000Z' } as Session,
    userId: 'u1',
    permissions: new Set<Permission>(opts.permissions),
  } satisfies TRPCContext;
  return {
    c: createCallerFactory(documentsRouter)(ctx),
    updated: () => updated,
    deleted: () => deleted,
    reviewWhere: () => reviewWhere,
  };
}

// project_manager-shaped: manage_files but NOT view_finances.
const PM: Permission[] = ['manage_files'];
const FINANCE: Permission[] = ['manage_files', 'view_finances'];

describe('documents.update SPI gate (audit H-1)', () => {
  it('denies a non-finance holder updating an SPI document', async () => {
    const { c, updated } = caller({ permissions: PM, doc: SPI_DOC });
    await expect(c.update({ id: 'spi-1', name: 'renamed.pdf' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(updated()).toBeNull();
  });

  it('denies a non-finance holder setting isSPI:true on a non-SPI document', async () => {
    const { c, updated } = caller({ permissions: PM, doc: NON_SPI_DOC });
    await expect(c.update({ id: 'doc-1', isSPI: true })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(updated()).toBeNull();
  });

  it('denies a non-finance holder clearing isSPI:false on an SPI document', async () => {
    const { c, updated } = caller({ permissions: PM, doc: SPI_DOC });
    await expect(c.update({ id: 'spi-1', isSPI: false })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(updated()).toBeNull();
  });

  it('allows a finance holder to update an SPI document, without ocrText in the response', async () => {
    const { c, updated } = caller({ permissions: FINANCE, doc: SPI_DOC });
    const result = await c.update({ id: 'spi-1', name: 'renamed.pdf' });
    expect(updated()).toMatchObject({ name: 'renamed.pdf' });
    expect(result).not.toHaveProperty('ocrText');
  });

  it('404s when the document does not exist', async () => {
    const { c } = caller({ permissions: PM, doc: null });
    await expect(c.update({ id: 'missing' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('documents.delete SPI gate (audit H-1)', () => {
  it('denies a non-finance holder deleting an SPI document', async () => {
    const { c, deleted } = caller({ permissions: PM, doc: SPI_DOC });
    await expect(c.delete({ id: 'spi-1' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(deleted()).toBe(false);
  });

  it('allows a finance holder to delete an SPI document', async () => {
    const { c, deleted } = caller({ permissions: FINANCE, doc: SPI_DOC });
    await expect(c.delete({ id: 'spi-1' })).resolves.toMatchObject({ id: 'spi-1' });
    expect(deleted()).toBe(true);
  });

  it('allows a non-finance holder to delete a non-SPI document', async () => {
    const { c, deleted } = caller({ permissions: PM, doc: NON_SPI_DOC });
    await expect(c.delete({ id: 'doc-1' })).resolves.toMatchObject({ id: 'doc-1' });
    expect(deleted()).toBe(true);
  });
});

describe('documents.decideReview SPI gate (audit H-1)', () => {
  const spiReview: ReviewFixture = { id: 'rev-1', fileId: 'spi-1', file: { isSPI: true } };
  const nonSpiReview: ReviewFixture = { id: 'rev-2', fileId: 'doc-1', file: { isSPI: false } };

  it('denies a non-finance holder deciding a review for an SPI document', async () => {
    const { c, updated } = caller({ permissions: PM, review: spiReview });
    await expect(
      c.decideReview({ reviewId: 'rev-1', status: 'confirmed' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(updated()).toBeNull();
  });

  it('allows a finance holder to decide a review for an SPI document', async () => {
    const { c } = caller({ permissions: FINANCE, review: spiReview });
    await expect(
      c.decideReview({ reviewId: 'rev-1', status: 'confirmed' }),
    ).resolves.toMatchObject({ status: 'confirmed' });
  });

  it('allows a non-finance holder to decide a review for a non-SPI document', async () => {
    const { c } = caller({ permissions: PM, review: nonSpiReview });
    await expect(
      c.decideReview({ reviewId: 'rev-2', status: 'confirmed' }),
    ).resolves.toMatchObject({ status: 'confirmed' });
  });
});

describe('documents.reviewTray SPI gate (audit H-1)', () => {
  it('excludes SPI documents from the where-clause for a non-finance holder', async () => {
    const { c, reviewWhere } = caller({ permissions: PM });
    await c.reviewTray();
    expect(reviewWhere()).toMatchObject({ file: { isSPI: false } });
  });

  it('does not restrict by isSPI for a finance holder', async () => {
    const { c, reviewWhere } = caller({ permissions: FINANCE });
    await c.reviewTray();
    expect(reviewWhere()).not.toHaveProperty('file');
  });
});
