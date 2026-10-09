// Edge-safe Auth.js config shared by the middleware and the full Node config
// (src/auth.ts). It carries NO Credentials provider and NO Prisma/bcrypt import,
// so it can run in the edge middleware runtime.
import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  pages: { signIn: '/login' },
  session: {
    strategy: 'jwt',
    // Bounded JWT lifetime (H-2): a stale cookie must not stay valid
    // indefinitely. 8h covers a normal work shift; re-authenticating daily is
    // an acceptable cost for a single-org self-hosted app (D-5).
    maxAge: 8 * 60 * 60,
  },
  providers: [],
} satisfies NextAuthConfig;
