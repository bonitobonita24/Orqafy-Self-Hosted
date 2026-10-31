// Shared L5 AuditLog writer (Rule 33 / `.ai_prompt/privacy.md` — DSR evidence,
// breach forensics, accountability). This is the ONE entry point every router
// should use to record an audit row — never call `prisma.auditLog.create`
// directly from a router, so the shape (userId/action/targetType/...) stays
// consistent fleet-wide.
import 'server-only';
import type { AuditTargetType, Prisma, PrismaClient } from '@orqafy/db';
import { clientIp } from './rate-limit';

export interface WriteAuditInput {
  userId: string;
  action: string;
  targetType: AuditTargetType;
  targetId?: string;
  /** Request IP (see `auditIp`); null/undefined = unknown, column stays NULL. */
  ip?: string | null;
  metadata?: Prisma.InputJsonValue;
}

/**
 * Request IP for an audit row, via the trusted-proxy-aware `clientIp`.
 * `clientIp` returns the literal 'unknown' when no header is present; that is
 * not an address, so it maps to null (column stays NULL).
 */
export function auditIp(req: Request): string | null {
  const ip = clientIp(req);
  return ip === 'unknown' ? null : ip;
}

/** Narrow Prisma-client slice `writeAudit` needs — keeps callers test-mockable. */
type AuditPrisma = Pick<PrismaClient, 'auditLog'>;

export async function writeAudit(prisma: AuditPrisma, input: WriteAuditInput): Promise<void> {
  const { userId, action, targetType, targetId, ip, metadata } = input;
  await prisma.auditLog.create({
    data: {
      userId,
      action,
      targetType,
      ...(targetId !== undefined ? { targetId } : {}),
      ...(ip !== undefined && ip !== null ? { ip } : {}),
      ...(metadata !== undefined ? { metadata } : {}),
    },
  });
}
