// Edge-safe Auth.js config shared by the middleware and the full Node config
// (src/auth.ts). It carries NO Credentials provider and NO Prisma/bcrypt import,
// so it can run in the edge middleware runtime.
import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
  providers: [],
} satisfies NextAuthConfig;
