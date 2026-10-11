// Session / identity router. The credentials sign-in itself is handled by
// Auth.js (src/auth.ts); this exposes the authenticated caller + their resolved
// permissions to the app.
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';
import { writeAudit } from '../audit';
import { hashPassword, verifyPassword } from '../../lib/password';
import {
  checkChangePasswordRateLimit,
  getRateLimitStore,
  recordChangePasswordSuccess,
} from '../rate-limit';

export const authRouter = router({
  /** The current user (safe fields) + their effective permissions (D-17). */
  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.userId },
      include: { role: true },
    });
    return {
      id: ctx.userId,
      name: user?.name ?? null,
      email: user?.email ?? null,
      role: user?.role.name ?? null,
      roleKey: user?.role.systemKey ?? null,
      permissions: [...ctx.permissions],
    };
  }),

  /**
   * Self-service password change (ORQ-55). Requires the caller's current
   * password; never reveals which field is wrong (generic UNAUTHORIZED).
   * passwordHash and passwordChangedAt are always set together (L-2).
   *
   * Rate-limited (W2b, defense-in-depth): the bcrypt `currentPassword` check
   * below is the same online-guessing surface the login path already
   * hardens — gated BEFORE the check via the SAME store/shape as
   * `checkLoginRateLimit`, keyed per-user (see rate-limit.ts). A legit
   * change resets the counter so success is never penalized.
   */
  changePassword: protectedProcedure
    .input(
      z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(8),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const store = getRateLimitStore();
      const rl = await checkChangePasswordRateLimit(store, ctx.userId);
      if (!rl.allowed) {
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: 'Too many attempts. Try again later.',
        });
      }

      const user = await ctx.prisma.user.findUnique({ where: { id: ctx.userId } });
      const ok = user !== null && (await verifyPassword(input.currentPassword, user.passwordHash));
      if (!ok) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Current password is incorrect.' });
      }

      await ctx.prisma.user.update({
        where: { id: ctx.userId },
        data: {
          passwordHash: await hashPassword(input.newPassword),
          passwordChangedAt: new Date(),
        },
      });

      await writeAudit(ctx.prisma, {
        userId: ctx.userId,
        action: 'auth.password_change',
        targetType: 'user',
        targetId: ctx.userId,
      });

      await recordChangePasswordSuccess(store, ctx.userId);

      return { ok: true as const };
    }),
});
