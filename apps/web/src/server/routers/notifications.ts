// Per-user notifications + the realtime feed (D-22). The `onNew` subscription is
// the websocket seam: it streams via the realtime bus and is carried by the WS
// transport wired in Part 7 (see server/realtime.ts).
import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { subscribeTo } from '../realtime';

export const notificationsRouter = router({
  list: protectedProcedure
    .input(z.object({ unreadOnly: z.boolean().default(false) }).optional())
    .query(async ({ ctx, input }) => {
      return ctx.prisma.notification.findMany({
        where: { userId: ctx.userId, ...(input?.unreadOnly === true ? { isRead: false } : {}) },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    }),

  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.notification.count({ where: { userId: ctx.userId, isRead: false } });
  }),

  markRead: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.notification.updateMany({
        where: { id: input.id, userId: ctx.userId },
        data: { isRead: true },
      });
      return { ok: true as const };
    }),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.prisma.notification.updateMany({
      where: { userId: ctx.userId, isRead: false },
      data: { isRead: true },
    });
    return { ok: true as const };
  }),

  /** Live feed of new notifications for the signed-in user (WS carrier: Part 7). */
  onNew: protectedProcedure.subscription(({ ctx }) => {
    return subscribeTo('notification:new', (payload) => payload.userId === ctx.userId);
  }),
});
