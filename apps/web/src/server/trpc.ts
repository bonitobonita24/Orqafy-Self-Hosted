// tRPC initialization — superjson transformer (Date-safe over the wire) and the
// procedure ladder: public → protected (authenticated) → permission-gated (D-17).
import 'server-only';
import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import type { Permission } from '@orqafy/shared';
import type { TRPCContext } from './context';

const t = initTRPC.context<TRPCContext>().create({ transformer: superjson });

export const router = t.router;
export const middleware = t.middleware;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;

/** Require an authenticated session; narrows `userId` to a non-null string. */
const enforceAuth = t.middleware(({ ctx, next }) => {
  if (ctx.userId === null || ctx.session === null) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Sign in required.' });
  }
  return next({ ctx: { ...ctx, userId: ctx.userId, session: ctx.session } });
});

export const protectedProcedure = t.procedure.use(enforceAuth);

/** Protected + requires ALL of the given permissions (D-17 RBAC). */
export function permissionProcedure(...required: Permission[]) {
  return protectedProcedure.use(({ ctx, next }) => {
    const ok = required.every((p) => ctx.permissions.has(p));
    if (!ok) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `Missing required permission(s): ${required.join(', ')}`,
      });
    }
    return next();
  });
}
