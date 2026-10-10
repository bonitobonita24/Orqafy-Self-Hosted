// First-run setup (D-5). On a fresh install there is NO user and NO seeded
// admin — the operator creates their OWN owner/admin account interactively.
// NO Powerbyte / universal credentials are ever seeded (D-5 hard rule). This
// also seeds the predefined system roles as PermissionGroups (D-17).
//
// AUDIT M-1 (v0.1.1): createFirstAdmin was a bare publicProcedure with no
// shared-secret gate — any first visitor to a freshly-deployed install could
// race to claim the owner account — AND its "already set up" guard
// (`user.count()`) ran OUTSIDE the `$transaction`, so two concurrent requests
// could both read count===0 and both create an owner (TOCTOU race -> two
// owners). Fixed by: (1) requiring a `setupToken` matched against
// `process.env.SETUP_TOKEN` in constant time before any DB work, and (2)
// moving the single-setup enforcement INSIDE the transaction behind a
// Postgres advisory lock that serializes concurrent setup attempts.
import { timingSafeEqual } from 'crypto';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, publicProcedure } from '../trpc';
import { SYSTEM_ROLE_LABEL, SYSTEM_ROLE_PERMISSIONS, SYSTEM_ROLE_ORDER } from '../roles';
import { hashPassword } from '../../lib/password';

const firstAdminInput = z.object({
  orgName: z.string().min(1, 'Organisation name is required.'),
  adminName: z.string().min(1, 'Your name is required.'),
  email: z.string().email(),
  password: z.string().min(8, 'Use at least 8 characters.'),
  setupToken: z.string().min(1, 'Setup token is required.'),
});

/**
 * Fixed Postgres advisory-lock key for first-run setup. Arbitrary bigint
 * constant (fits a signed 64-bit int) — only ever used to serialize
 * concurrent `createFirstAdmin` calls against each other, nothing else.
 */
const SETUP_ADVISORY_LOCK_KEY = 847_201_559_301n;

/**
 * Constant-time comparison of the caller-supplied setup token against
 * SETUP_TOKEN. Guards the length check first (timingSafeEqual throws on a
 * length mismatch) — the length check itself leaks only string length, never
 * byte content, and SETUP_TOKEN length is not a secret worth protecting.
 */
function safeTokenEquals(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export const setupRouter = router({
  /** Whether the install still needs its first-run setup (no users yet). */
  status: publicProcedure.query(async ({ ctx }) => {
    const users = await ctx.prisma.user.count();
    return { needsSetup: users === 0 };
  }),

  /** Create the operator's own admin account + seed org and system roles. */
  createFirstAdmin: publicProcedure.input(firstAdminInput).mutation(async ({ ctx, input }) => {
    // 1. Shared-secret gate — BEFORE any DB work or password hashing.
    const expectedToken = process.env.SETUP_TOKEN;
    if (expectedToken === undefined || expectedToken.length === 0) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Server is missing SETUP_TOKEN; first-run setup is disabled.',
      });
    }
    if (!safeTokenEquals(input.setupToken, expectedToken)) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid setup token.' });
    }

    // Cheap pre-transaction check — fast friendly path only, NOT authoritative
    // (the in-transaction lock+recheck below is the real guard against the race).
    const existing = await ctx.prisma.user.count();
    if (existing > 0) {
      throw new TRPCError({ code: 'CONFLICT', message: 'Setup has already been completed.' });
    }

    const passwordHash = await hashPassword(input.password);
    const email = input.email.trim().toLowerCase();

    const admin = await ctx.prisma.$transaction(async (tx) => {
      // 2. Race-safe single-setup: acquire a session-transaction advisory
      // lock FIRST so concurrent setup attempts serialize against each
      // other, THEN re-check user.count() as the authoritative guard. The
      // second transaction to reach here waits for the first to commit,
      // then sees count > 0 and throws CONFLICT — guaranteeing exactly one
      // owner regardless of request interleaving.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SETUP_ADVISORY_LOCK_KEY})`;

      const count = await tx.user.count();
      if (count > 0) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Setup has already been completed.' });
      }

      // Reuse the existing Organization row (e.g. the dev seed's
      // `org_default`) if one is already there instead of blindly creating a
      // second — the single-org invariant (D-5) means there is ONLY EVER one
      // row, and first-run setup must not be the thing that breaks it when
      // the dev seed happened to run first.
      const existingOrg = await tx.organization.findFirst({ orderBy: { createdAt: 'asc' } });
      if (existingOrg === null) {
        await tx.organization.create({ data: { name: input.orgName } });
      } else {
        await tx.organization.update({
          where: { id: existingOrg.id },
          data: { name: input.orgName },
        });
      }

      // Seed the predefined system roles as PermissionGroups (D-17).
      const roleGroups = new Map<string, string>();
      for (const role of SYSTEM_ROLE_ORDER) {
        const group = await tx.permissionGroup.create({
          data: {
            name: SYSTEM_ROLE_LABEL[role],
            permissions: SYSTEM_ROLE_PERMISSIONS[role],
            isSystem: true,
            systemKey: role,
          },
        });
        roleGroups.set(role, group.id);
      }

      const ownerRoleId = roleGroups.get('owner_admin');
      if (ownerRoleId === undefined) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Role seed failed.' });
      }

      return tx.user.create({
        data: {
          name: input.adminName,
          email,
          passwordHash,
          roleId: ownerRoleId,
        },
      });
    });

    return { ok: true as const, userId: admin.id };
  }),
});
