// Projects under a client (D-5). Progress rolls up from tasks (roll-up job is a
// background worker — Part 6/jobs; here `progressPct` is read/write metadata).
import { z } from 'zod';
import { ProjectStatus } from '@orqafy/db';
import { router, protectedProcedure, permissionProcedure } from '../trpc';
import { omitUndefined } from '../util';

// Status is validated against the Prisma-native enum (values `on_hold`,
// `in_progress` — the DB stores the hyphenated form via @map, invisible to TS),
// keeping the tRPC contract 1:1 with the database layer.
const projectStatus = z.nativeEnum(ProjectStatus);

export const projectsRouter = router({
  list: protectedProcedure
    .input(z.object({ status: projectStatus.optional() }).optional())
    .query(async ({ ctx, input }) => {
      return ctx.prisma.project.findMany({
        where: omitUndefined({ status: input?.status }),
        orderBy: { updatedAt: 'desc' },
        include: {
          client: { select: { id: true, name: true } },
          _count: { select: { tasks: true, milestones: true } },
        },
      });
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.project.findUnique({
        where: { id: input.id },
        include: {
          client: true,
          milestones: { orderBy: { targetDate: 'asc' } },
          tasks: {
            orderBy: { createdAt: 'asc' },
            include: { assignee: { select: { id: true, name: true } } },
          },
        },
      });
    }),

  create: permissionProcedure('create_project')
    .input(
      z.object({
        name: z.string().min(1),
        code: z.string().min(1),
        clientId: z.string().min(1),
        status: projectStatus.default(ProjectStatus.planning),
        description: z.string().optional(),
        startDate: z.date().optional(),
        targetEndDate: z.date().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.project.create({
        data: {
          name: input.name,
          code: input.code,
          clientId: input.clientId,
          status: input.status,
          ...omitUndefined({
            description: input.description,
            startDate: input.startDate,
            targetEndDate: input.targetEndDate,
          }),
        },
      });
    }),

  update: permissionProcedure('create_project')
    .input(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1).optional(),
        status: projectStatus.optional(),
        description: z.string().optional(),
        progressPct: z.number().int().min(0).max(100).optional(),
        startDate: z.date().optional(),
        targetEndDate: z.date().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      return ctx.prisma.project.update({ where: { id }, data: omitUndefined(rest) });
    }),
});
