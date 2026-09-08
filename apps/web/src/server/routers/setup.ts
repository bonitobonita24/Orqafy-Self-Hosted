// First-run setup (D-5). On a fresh install there is NO user and NO seeded
// admin — the operator creates their OWN owner/admin account interactively.
// NO Powerbyte / universal credentials are ever seeded (D-5 hard rule). This
// also seeds the predefined system roles as PermissionGroups (D-17).
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
});

export const setupRouter = router({
  /** Whether the install still needs its first-run setup (no users yet). */
  status: publicProcedure.query(async ({ ctx }) => {
    const users = await ctx.prisma.user.count();
    return { needsSetup: users === 0 };
  }),

  /** Create the operator's own admin account + seed org and system roles. */
  createFirstAdmin: publicProcedure.input(firstAdminInput).mutation(async ({ ctx, input }) => {
    const existing = await ctx.prisma.user.count();
    if (existing > 0) {
      throw new TRPCError({ code: 'CONFLICT', message: 'Setup has already been completed.' });
    }

    const passwordHash = await hashPassword(input.password);
    const email = input.email.trim().toLowerCase();

    const admin = await ctx.prisma.$transaction(async (tx) => {
      await tx.organization.create({ data: { name: input.orgName } });

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
