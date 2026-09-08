// Clients — first-class records under the single org (D-5). Reads are open to any
// authenticated user; writes require `create_project` (client + project admin).
import { z } from 'zod';
import { router, protectedProcedure, permissionProcedure } from '../trpc';
import { omitUndefined } from '../util';

const upsertInput = z.object({
  name: z.string().min(1),
  contactPerson: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});

export const clientsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.client.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { projects: true } } },
    });
  }),

  byId: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.client.findUnique({
        where: { id: input.id },
        include: { projects: true },
      });
    }),

  create: permissionProcedure('create_project')
    .input(upsertInput)
    .mutation(async ({ ctx, input }) => {
      const { name, ...optional } = input;
      return ctx.prisma.client.create({ data: { name, ...omitUndefined(optional) } });
    }),

  update: permissionProcedure('create_project')
    .input(upsertInput.partial().extend({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      return ctx.prisma.client.update({ where: { id }, data: omitUndefined(rest) });
    }),
});
