// Session / identity router. The credentials sign-in itself is handled by
// Auth.js (src/auth.ts); this exposes the authenticated caller + their resolved
// permissions to the app.
import { router, protectedProcedure } from '../trpc';

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
});
