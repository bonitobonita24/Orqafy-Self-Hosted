// DPA retention sweep (Rule 33 / `.ai_prompt/privacy.md` RetentionPolicy
// sketch; DPA W6). Single-org app (D-5) — the one `Organization` row carries
// `retentionSettings: { category: retainDays }` (DPO-configured, D-20).
//
// Per-category deletion target (cutoff = now - retainDays):
//   audit_log          AuditLog.timestamp
//   notification       Notification.createdAt
//   photo              Photo.createdAt
//   document           Document.createdAt WHERE isSPI = false AND
//                       category != 'payroll' — SPI + payroll documents are
//                       NEVER auto-deleted by this job (D-20, data minimization
//                       cuts both ways: heightened-protection data is excluded
//                       from automatic erasure, not just from broad search).
//   completed_project  Project.updatedAt WHERE status = 'completed' — Project
//                       has no dedicated completion timestamp; `updatedAt` is
//                       the best-available proxy, used deliberately and noted
//                       here rather than invented silently.
//   leave_request      LeaveRequest.endDate WHERE status IN
//                       ('approved', 'rejected') — decided, non-pending
//                       requests only.
//
// DRY-RUN (the scheduler's default) only counts candidates — nothing is
// deleted. ENFORCE deletes, but NEVER cascade-deletes business data: if a
// category's rows still have dependents (e.g. a completed project whose
// Tasks/Documents still point at it — Prisma raises a foreign-key error on
// `deleteMany`), that category is left untouched for this run and its
// candidate count is recorded under `skipped` instead of `deleted`.
// TODO(dpa-w7+): a safe archival/cascade path for completed_project once the
// owner locks one (PENDING_DECISIONS.md) — this job never invents one.

import type { Prisma, PrismaClient } from '@orqafy/db';
import { getOrganization } from '@orqafy/db';
import { retentionSettingsSchema, type RetentionCategory, type RetentionSettings } from '@orqafy/shared';

import type { RetentionSweepJobData, RetentionSweepJobResult } from './queues';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

type CategoryTally = Partial<Record<RetentionCategory, number>>;

interface CategoryOps {
  count: (prisma: PrismaClient, cutoff: Date) => Promise<number>;
  deleteMany: (prisma: PrismaClient, cutoff: Date) => Promise<number>;
}

/** One entry per `RetentionCategory` — the table referenced in the header comment. */
const CATEGORY_OPS: Record<RetentionCategory, CategoryOps> = {
  audit_log: {
    count: (prisma, cutoff) => prisma.auditLog.count({ where: { timestamp: { lt: cutoff } } }),
    deleteMany: async (prisma, cutoff) =>
      (await prisma.auditLog.deleteMany({ where: { timestamp: { lt: cutoff } } })).count,
  },
  notification: {
    count: (prisma, cutoff) => prisma.notification.count({ where: { createdAt: { lt: cutoff } } }),
    deleteMany: async (prisma, cutoff) =>
      (await prisma.notification.deleteMany({ where: { createdAt: { lt: cutoff } } })).count,
  },
  photo: {
    count: (prisma, cutoff) => prisma.photo.count({ where: { createdAt: { lt: cutoff } } }),
    deleteMany: async (prisma, cutoff) =>
      (await prisma.photo.deleteMany({ where: { createdAt: { lt: cutoff } } })).count,
  },
  document: {
    count: (prisma, cutoff) =>
      prisma.document.count({
        where: { createdAt: { lt: cutoff }, isSPI: false, category: { not: 'payroll' } },
      }),
    deleteMany: async (prisma, cutoff) =>
      (
        await prisma.document.deleteMany({
          where: { createdAt: { lt: cutoff }, isSPI: false, category: { not: 'payroll' } },
        })
      ).count,
  },
  completed_project: {
    count: (prisma, cutoff) =>
      prisma.project.count({ where: { status: 'completed', updatedAt: { lt: cutoff } } }),
    deleteMany: async (prisma, cutoff) =>
      (await prisma.project.deleteMany({ where: { status: 'completed', updatedAt: { lt: cutoff } } })).count,
  },
  leave_request: {
    count: (prisma, cutoff) =>
      prisma.leaveRequest.count({
        where: { status: { in: ['approved', 'rejected'] }, endDate: { lt: cutoff } },
      }),
    deleteMany: async (prisma, cutoff) =>
      (
        await prisma.leaveRequest.deleteMany({
          where: { status: { in: ['approved', 'rejected'] }, endDate: { lt: cutoff } },
        })
      ).count,
  },
};

/** Stable iteration order for the sweep (matches the enum declaration order). */
const CATEGORIES = Object.keys(CATEGORY_OPS) as RetentionCategory[];

/**
 * Run one sweep pass. Reads the single Organization's `retentionSettings`,
 * counts (and, in `enforce` mode, deletes) expired rows per category, and
 * writes one system-actor AuditLog summary row (`userId: null` — no acting
 * human user; DPA W6's PM-authorized schema change).
 */
export async function runRetentionSweep(
  prisma: PrismaClient,
  mode: RetentionSweepJobData['mode'],
): Promise<RetentionSweepJobResult> {
  const candidates: CategoryTally = {};
  const deleted: CategoryTally = {};
  const skipped: CategoryTally = {};

  const org = await getOrganization(prisma);

  let settings: RetentionSettings = {};
  if (org !== null && org.retentionSettings !== null && org.retentionSettings !== undefined) {
    const parsed = retentionSettingsSchema.safeParse(org.retentionSettings);
    if (parsed.success) {
      settings = parsed.data;
    } else {
      // Invalid/unrecognized settings JSON — treat as "no policy configured"
      // rather than guessing; never delete on an unparseable config.
      // eslint-disable-next-line no-console
      console.warn(
        '[jobs] retention-sweep: org.retentionSettings failed validation, skipping all deletion this run',
        parsed.error.message,
      );
    }
  }

  for (const category of CATEGORIES) {
    const retainDays = settings[category];
    if (retainDays === undefined || retainDays <= 0) continue;

    const cutoff = new Date(Date.now() - retainDays * MS_PER_DAY);
    const ops = CATEGORY_OPS[category];
    const count = await ops.count(prisma, cutoff);
    if (count === 0) continue;
    candidates[category] = count;

    if (mode === 'enforce') {
      try {
        deleted[category] = await ops.deleteMany(prisma, cutoff);
      } catch (err) {
        skipped[category] = count;
        // eslint-disable-next-line no-console
        console.warn(`[jobs] retention-sweep: skipped category "${category}" (delete blocked, likely FK dependents)`, err);
      }
    }
  }

  const result: RetentionSweepJobResult = { mode, candidates, deleted, skipped };

  if (org !== null) {
    await prisma.auditLog.create({
      data: {
        userId: null,
        action: 'retention.sweep',
        targetType: 'organization',
        targetId: org.id,
        metadata: result as unknown as Prisma.InputJsonValue,
      },
    });
  }

  return result;
}
