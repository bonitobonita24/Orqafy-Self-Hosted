// Users + roles + permission groups + per-user overrides (D-17). All writes are
// gated behind `manage_users`; the permission builder (custom groups, overrides)
// is a v1 build item and its full editor UI is Part 6 — the API surface is here.
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { permissionEnum, systemRoleEnum } from '@orqafy/shared';
import { router, protectedProcedure, permissionProcedure } from '../trpc';
import { omitUndefined } from '../util';
import { hashPassword } from '../../lib/password';

const manageUsers = () => permissionProcedure('manage_users');

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
