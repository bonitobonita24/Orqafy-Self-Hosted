// Milestones — project checkpoints (PRODUCT Core Entities). A milestone is
// created/edited from the project detail page. Writes are gated behind
// `create_project` (the same permission that owns the project lifecycle);
// listing rides on `projects.byId` (its `milestones` include). Client sign-off
// (signOff* fields) is a v2 flow and is NOT exposed here.
import { z } from 'zod';
import { MilestoneStatus } from '@orqafy/db';
import { router, permissionProcedure } from '../trpc';
import { omitUndefined } from '../util';

// Status is validated against the Prisma-native enum (value `in_progress` maps to
// the DB's hyphenated form via @map), keeping the tRPC contract 1:1 with the DB.
const milestoneStatus = z.nativeEnum(MilestoneStatus);
const manageMilestones = () => permissionProcedure('create_project');

export const milestonesRouter = router({
  create: manageMilestones()
    .input(
      z.object({
        projectId: z.string().min(1),
        title: z.string().min(1),
        status: milestoneStatus.default(MilestoneStatus.pending),
        targetDate: z.date().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.milestone.create({
        data: {
          projectId: input.projectId,
          title: input.title,
          status: input.status,
          ...omitUndefined({ targetDate: input.targetDate }),
        },
      });
    }),

  update: manageMilestones()
    .input(
      z.object({
        id: z.string().min(1),
        title: z.string().min(1).optional(),
        status: milestoneStatus.optional(),
        targetDate: z.date().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      return ctx.prisma.milestone.update({ where: { id }, data: omitUndefined(rest) });
    }),
});
