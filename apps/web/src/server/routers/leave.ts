// Leave management (D-21) — leave ONLY, no attendance/payroll. Any user applies
// for their own leave; approval requires `approve_leave`. `reason` never requires
// health detail (SPI minimisation, PH DPA — D-21).
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, permissionProcedure } from '../trpc';
import { omitUndefined } from '../util';

export const leaveRouter = router({
  types: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.leaveType.findMany({ orderBy: { name: 'asc' } });
  }),

  myBalances: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.leaveBalance.findMany({
      where: { userId: ctx.userId },
      include: { leaveType: { select: { name: true, isPaid: true } } },
      orderBy: { year: 'desc' },
    });
  }),

  myRequests: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.leaveRequest.findMany({
      where: { userId: ctx.userId },
      orderBy: { createdAt: 'desc' },
      include: { leaveType: { select: { name: true } } },
    });
  }),

  // NB: not named `apply` — tRPC reserves Function.prototype method names.
  submitRequest: protectedProcedure
    .input(
      z.object({
        leaveTypeId: z.string().min(1),
        startDate: z.date(),
        endDate: z.date(),
        reason: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.endDate < input.startDate) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'End date is before start date.' });
      }
      return ctx.prisma.leaveRequest.create({
        data: {
          userId: ctx.userId,
          leaveTypeId: input.leaveTypeId,
          startDate: input.startDate,
          endDate: input.endDate,
          ...omitUndefined({ reason: input.reason }),
        },
      });
    }),

  /** Requests awaiting a decision — the dashboard "pending approvals" surface. */
  pendingApprovals: permissionProcedure('approve_leave').query(async ({ ctx }) => {
    return ctx.prisma.leaveRequest.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { id: true, name: true } },
        leaveType: { select: { name: true } },
      },
    });
  }),

  decide: permissionProcedure('approve_leave')
    .input(z.object({ id: z.string().min(1), approve: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.leaveRequest.update({
        where: { id: input.id },
        data: {
          status: input.approve ? 'approved' : 'rejected',
          approvedBy: ctx.userId,
          approvedAt: new Date(),
        },
      });
    }),
});
