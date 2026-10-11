// Fresh per-request auth-state re-check for an already-identified cookie-session user.
//
// The mobile bearer path (bearer-identity.ts) already re-checks `isActive` AND
// `passwordChangedAt` from the DB on every request, because a stateless token
// cannot otherwise be revoked. The Auth.js cookie-session path mirrors both
// checks here: H-2 (deactivated user) and L-2 (session issued before a
// password change) — injectable for unit tests.
import 'server-only';
import { prisma } from '@orqafy/db';

export interface UserAuthState {
  isActive: boolean;
  passwordChangedAt: Date | null;
}

export interface ActiveUserDeps {
  getUserAuthState: (userId: string) => Promise<UserAuthState | null>;
}

export const defaultActiveUserDeps: ActiveUserDeps = {
  getUserAuthState: async (userId) => {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isActive: true, passwordChangedAt: true },
    });
    return user ?? null;
  },
};
