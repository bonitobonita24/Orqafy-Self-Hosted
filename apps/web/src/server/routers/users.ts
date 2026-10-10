// Users + roles + permission groups + per-user overrides (D-17). All writes are
// gated behind `manage_users`; the permission builder (custom groups, overrides)
// is a v1 build item and its full editor UI is Part 6 — the API surface is here.
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import type { Permission, PermissionGroup, UserPermissionOverride } from '@orqafy/db';
import { permissionEnum, systemRoleEnum, eraseUserSchema } from '@orqafy/shared';
import { router, protectedProcedure, permissionProcedure } from '../trpc';
import { omitUndefined } from '../util';
import { writeAudit } from '../audit';
import { hashPassword } from '../../lib/password';

const manageUsers = () => permissionProcedure('manage_users');

const ADMIN_PERMISSIONS: readonly Permission[] = ['manage_users', 'configure_server'];

/**
 * Effective permission set for a user fetched with { role, groups, overrides }
 * (role ∪ groups, overrides applied last) — the SAME resolution algorithm as
 * `server/permissions.ts#resolveUserPermissions`, duplicated here so it runs
 * against `ctx.prisma` (test-mockable) instead of the global `prisma` import
 * that function uses internally.
 */
function effectivePermissions(user: {
  role: PermissionGroup;
  groups: PermissionGroup[];
  overrides: UserPermissionOverride[];
}): Set<Permission> {
  const effective = new Set<Permission>();
  for (const perm of user.role.permissions) effective.add(perm);
  for (const group of user.groups) {
    for (const perm of group.permissions) effective.add(perm);
  }
  for (const override of user.overrides) {
    if (override.granted) effective.add(override.permission);
    else effective.delete(override.permission);
  }
  return effective;
}

function hasAdminPower(perms: ReadonlySet<Permission>): boolean {
  return ADMIN_PERMISSIONS.some((p) => perms.has(p));
}

export const usersRouter = router({
  list: manageUsers().query(async ({ ctx }) => {
    return ctx.prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      include: { role: { select: { name: true, systemKey: true } } },
    });
  }),

  byId: manageUsers()
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.user.findUnique({
        where: { id: input.id },
        include: { role: true, groups: true, overrides: true },
      });
    }),

  create: manageUsers()
    .input(
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
        password: z.string().min(8),
        roleId: z.string().min(1),
        groupIds: z.array(z.string().min(1)).default([]),
        phone: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const passwordHash = await hashPassword(input.password);
      return ctx.prisma.user.create({
        data: {
          name: input.name,
          email: input.email.trim().toLowerCase(),
          passwordHash,
          roleId: input.roleId,
          groups: { connect: input.groupIds.map((id) => ({ id })) },
          ...omitUndefined({ phone: input.phone }),
        },
      });
    }),

  update: manageUsers()
    .input(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1).optional(),
        roleId: z.string().min(1).optional(),
        phone: z.string().optional(),
        isActive: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      return ctx.prisma.user.update({ where: { id }, data: omitUndefined(rest) });
    }),

  /** Per-user permission override (D-17): grant or revoke a single permission. */
  setOverride: manageUsers()
    .input(
      z.object({
        userId: z.string().min(1),
        permission: permissionEnum,
        granted: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.userPermissionOverride.upsert({
        where: { userId_permission: { userId: input.userId, permission: input.permission } },
        create: { userId: input.userId, permission: input.permission, granted: input.granted },
        update: { granted: input.granted },
      });
    }),

  clearOverride: manageUsers()
    .input(z.object({ userId: z.string().min(1), permission: permissionEnum }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.userPermissionOverride.deleteMany({
        where: { userId: input.userId, permission: input.permission },
      });
      return { ok: true as const };
    }),

  /**
   * Right-to-erasure (DPA W5, `.ai_prompt/privacy.md` dsr.erase) — CONTROLLER-
   * OPERATED, pseudonymize-in-place. Never hard-deletes the User row: tasks,
   * documents, photos, milestones, and AuditLog rows reference it as a
   * business/legal record and are RETAINED. Session/mobile-token revocation
   * is implicit — `isActive: false` is re-checked on every request (H-2),
   * there is no token table to separately invalidate.
   */
  erase: manageUsers()
    .input(eraseUserSchema)
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.userId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'You cannot erase your own account — ask another administrator.',
        });
      }

      const target = await ctx.prisma.user.findUnique({
        where: { id: input.userId },
        include: { role: true, groups: true, overrides: true },
      });
      if (target === null) throw new TRPCError({ code: 'NOT_FOUND' });
      if (target.anonymizedAt !== null) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'This user is already erased.' });
      }

      // Last-admin guard: if the target currently holds admin-tier power
      // (manage_users or configure_server, via role ∪ groups ∪ overrides —
      // same resolution as context.ts/trpc.ts), at least one OTHER active,
      // non-erased user must retain that power after this erasure.
      if (hasAdminPower(effectivePermissions(target))) {
        const others = await ctx.prisma.user.findMany({
          where: { id: { not: target.id }, isActive: true, anonymizedAt: null },
          include: { role: true, groups: true, overrides: true },
        });
        const adminRemains = others.some((u) => hasAdminPower(effectivePermissions(u)));
        if (!adminRemains) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Cannot erase the last administrator.',
          });
        }
      }

      // Scrub PII. User columns beyond id/roleId/isActive/timestamps are:
      // name, email, phone, passwordHash — all four are scrubbed below.
      const randomPasswordHash = await hashPassword(randomBytes(32).toString('hex'));
      const anonymizedEmail = `erased+${target.id}@orqafy.invalid`;

      await ctx.prisma.$transaction(async (tx) => {
        // Notifications are transient per-user alerts — no retention value once erased.
        await tx.notification.deleteMany({ where: { userId: target.id } });
        // Leave requests themselves are a business/attendance record and are
        // RETAINED; only the free-text `reason` (potentially sensitive) is cleared.
        await tx.leaveRequest.updateMany({
          where: { userId: target.id },
          data: { reason: null },
        });
        await tx.user.update({
          where: { id: target.id },
          data: {
            name: 'Erased user',
            email: anonymizedEmail,
            phone: null,
            passwordHash: randomPasswordHash,
            isActive: false,
            anonymizedAt: new Date(),
          },
        });
      });

      await writeAudit(ctx.prisma, {
        userId: ctx.userId,
        action: 'data_subject.erase',
        targetType: 'user',
        targetId: target.id,
        metadata: {},
      });

      return { ok: true as const };
    }),
});

export const rolesRouter = router({
  /** The full permission vocabulary — the atoms the group builder composes. */
  permissions: protectedProcedure.query(() => permissionEnum.options),

  /** All permission groups (system roles + custom groups). */
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.permissionGroup.findMany({ orderBy: { createdAt: 'asc' } });
  }),

  create: permissionProcedure('manage_users')
    .input(
      z.object({
        name: z.string().min(1),
        permissions: z.array(permissionEnum).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.permissionGroup.create({
        data: { name: input.name, permissions: input.permissions, isSystem: false },
      });
    }),

  update: permissionProcedure('manage_users')
    .input(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1).optional(),
        permissions: z.array(permissionEnum).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const group = await ctx.prisma.permissionGroup.findUnique({ where: { id: input.id } });
      if (group === null) throw new TRPCError({ code: 'NOT_FOUND' });
      // System-role groups keep their identity; only their permission set is editable.
      const data = omitUndefined({
        name: group.isSystem ? undefined : input.name,
        permissions: input.permissions,
      });
      return ctx.prisma.permissionGroup.update({ where: { id: input.id }, data });
    }),

  delete: permissionProcedure('manage_users')
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const group = await ctx.prisma.permissionGroup.findUnique({ where: { id: input.id } });
      if (group === null) throw new TRPCError({ code: 'NOT_FOUND' });
      if (group.isSystem) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'System roles cannot be deleted.' });
      }
      await ctx.prisma.permissionGroup.delete({ where: { id: input.id } });
      return { ok: true as const };
    }),

  /** Enumerate the predefined system-role keys (UI labels). */
  systemKeys: protectedProcedure.query(() => systemRoleEnum.options),
});
