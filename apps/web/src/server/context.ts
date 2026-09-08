// tRPC request context. Carries the Prisma client, the Auth.js session, and the
// caller's resolved permission set (D-17) so every procedure can authorize
// against fresh grants.
import 'server-only';
import type { Session } from 'next-auth';
import type { Permission } from '@orqafy/shared';
import { prisma } from '@orqafy/db';
import { auth } from '../auth';
import { resolveUserPermissions } from './permissions';

export interface TRPCContext {
  prisma: typeof prisma;
  session: Session | null;
  userId: string | null;
  permissions: Set<Permission>;
}

/** Build the per-request context from the Auth.js session (cookie-based). */
export async function createTRPCContext(): Promise<TRPCContext> {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const permissions =
    userId !== null ? await resolveUserPermissions(userId) : new Set<Permission>();
  return { prisma, session, userId, permissions };
}
