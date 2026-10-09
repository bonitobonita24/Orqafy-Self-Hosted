// Fresh `isActive` re-check for an already-identified cookie-session user.
//
// The mobile bearer path (bearer-identity.ts) already re-checks `isActive` from
// the DB on every request, because a stateless token cannot otherwise be
// revoked. The Auth.js cookie-session path previously had NO equivalent check:
// a JWT session issued at login time kept authenticating the request for the
// rest of its lifetime even after an operator flipped `isActive` to false
// (audit H-2). This module gives the cookie-session paths (tRPC context +
// plain Route Handlers) the same fresh re-check, injectable for unit tests.
import 'server-only';
import { prisma } from '@orqafy/db';

export interface ActiveUserDeps {
  isUserActive: (userId: string) => Promise<boolean>;
}

export const defaultActiveUserDeps: ActiveUserDeps = {
  isUserActive: async (userId) => {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { isActive: true } });
    return user?.isActive ?? false;
  },
};
