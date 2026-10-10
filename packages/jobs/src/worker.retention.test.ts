import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runRetentionSweep } from './retention';
import type { PrismaClient } from '@orqafy/db';

interface MockPrisma {
  organization: { findFirst: ReturnType<typeof vi.fn> };
  auditLog: { count: ReturnType<typeof vi.fn>; deleteMany: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  notification: { count: ReturnType<typeof vi.fn>; deleteMany: ReturnType<typeof vi.fn> };
  photo: { count: ReturnType<typeof vi.fn>; deleteMany: ReturnType<typeof vi.fn> };
  document: { count: ReturnType<typeof vi.fn>; deleteMany: ReturnType<typeof vi.fn> };
  project: { count: ReturnType<typeof vi.fn>; deleteMany: ReturnType<typeof vi.fn> };
  leaveRequest: { count: ReturnType<typeof vi.fn>; deleteMany: ReturnType<typeof vi.fn> };
}

function makePrisma(retentionSettings: unknown): MockPrisma {
  return {
    organization: { findFirst: vi.fn(() => Promise.resolve({ id: 'org1', retentionSettings })) },
    auditLog: {
      count: vi.fn(() => Promise.resolve(0)),
      deleteMany: vi.fn(() => Promise.resolve({ count: 0 })),
      create: vi.fn(() => Promise.resolve({})),
    },
    notification: { count: vi.fn(() => Promise.resolve(0)), deleteMany: vi.fn(() => Promise.resolve({ count: 0 })) },
    photo: { count: vi.fn(() => Promise.resolve(0)), deleteMany: vi.fn(() => Promise.resolve({ count: 0 })) },
    document: { count: vi.fn(() => Promise.resolve(0)), deleteMany: vi.fn(() => Promise.resolve({ count: 0 })) },
    project: { count: vi.fn(() => Promise.resolve(0)), deleteMany: vi.fn(() => Promise.resolve({ count: 0 })) },
    leaveRequest: { count: vi.fn(() => Promise.resolve(0)), deleteMany: vi.fn(() => Promise.resolve({ count: 0 })) },
  };
}

const asPrisma = (p: MockPrisma): PrismaClient => p as unknown as PrismaClient;

describe('runRetentionSweep', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // Regression: a bare `findFirst()` with no `orderBy` gives Postgres no
  // ordering guarantee — if more than one Organization row ever existed, the
  // sweep could read a DIFFERENT row than apps/web's org.ts settings router
  // just wrote. getOrganization() (packages/db) fixes this with a
  // deterministic `orderBy: { createdAt: 'asc' }`.
  it('reads the Organization row via a deterministic orderBy (immune to row ordering)', async () => {
    const prisma = makePrisma({});
    await runRetentionSweep(asPrisma(prisma), 'dry-run');
    expect(prisma.organization.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'asc' } }),
    );
  });

  it('dry-run counts candidates and deletes nothing', async () => {
    const prisma = makePrisma({ audit_log: 30, document: 60 });
    prisma.auditLog.count.mockResolvedValue(5);
    prisma.document.count.mockResolvedValue(3);

    const result = await runRetentionSweep(asPrisma(prisma), 'dry-run');

    expect(result).toMatchObject({ mode: 'dry-run', candidates: { audit_log: 5, document: 3 }, deleted: {}, skipped: {} });
    expect(prisma.auditLog.deleteMany).not.toHaveBeenCalled();
    expect(prisma.document.deleteMany).not.toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- nested expect.objectContaining is typed `any` by vitest
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: null, action: 'retention.sweep', targetType: 'organization', targetId: 'org1' }) }));
  });

  it('enforce with days=0/absent is a no-op', async () => {
    const prisma = makePrisma({ audit_log: 0, document: 0 });

    const result = await runRetentionSweep(asPrisma(prisma), 'enforce');

    expect(result).toMatchObject({ mode: 'enforce', candidates: {}, deleted: {}, skipped: {} });
    expect(prisma.auditLog.count).not.toHaveBeenCalled();
    expect(prisma.auditLog.deleteMany).not.toHaveBeenCalled();
    expect(prisma.document.count).not.toHaveBeenCalled();
    expect(prisma.document.deleteMany).not.toHaveBeenCalled();
  });

  it('excludes SPI documents from both count and delete', async () => {
    const prisma = makePrisma({ document: 10 });
    prisma.document.count.mockResolvedValue(2);
    prisma.document.deleteMany.mockResolvedValue({ count: 2 });

    const result = await runRetentionSweep(asPrisma(prisma), 'enforce');

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- nested expect.objectContaining is typed `any` by vitest
    expect(prisma.document.count).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ isSPI: false, category: { not: 'payroll' } }) }));
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- nested expect.objectContaining is typed `any` by vitest
    expect(prisma.document.deleteMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ isSPI: false, category: { not: 'payroll' } }) }));
    expect(result.deleted.document).toBe(2);
  });

  it('computes the cutoff from retainDays against the current clock', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-10T00:00:00.000Z'));
    const prisma = makePrisma({ audit_log: 5 });
    prisma.auditLog.count.mockResolvedValue(1);

    await runRetentionSweep(asPrisma(prisma), 'dry-run');

    expect(prisma.auditLog.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: { timestamp: { lt: new Date('2026-01-05T00:00:00.000Z') } } }),
    );
  });

  it('invalid retentionSettings JSON skips all deletion', async () => {
    const prisma = makePrisma({ audit_log: 'thirty' });

    const result = await runRetentionSweep(asPrisma(prisma), 'enforce');

    expect(result).toMatchObject({ candidates: {}, deleted: {}, skipped: {} });
    expect(prisma.auditLog.count).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalled();
  });

  it('skips a category (never force-deletes) when deleteMany throws an FK error', async () => {
    const prisma = makePrisma({ completed_project: 90 });
    prisma.project.count.mockResolvedValue(4);
    prisma.project.deleteMany.mockRejectedValue(new Error('FK constraint violated'));

    const result = await runRetentionSweep(asPrisma(prisma), 'enforce');

    expect(result.candidates.completed_project).toBe(4);
    expect(result.deleted.completed_project).toBeUndefined();
    expect(result.skipped.completed_project).toBe(4);
  });

  it('returns an empty result and skips the AuditLog write when no Organization exists', async () => {
    const prisma = makePrisma({});
    prisma.organization.findFirst.mockResolvedValue(null);

    const result = await runRetentionSweep(asPrisma(prisma), 'dry-run');

    expect(result).toMatchObject({ mode: 'dry-run', candidates: {}, deleted: {}, skipped: {} });
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });
});
