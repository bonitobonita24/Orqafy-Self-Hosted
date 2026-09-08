// Auth.js v5 — credentials sign-in against the app's own user table (D-5: NO
// Powerbyte/universal creds; the operator's admin is created at first-run). JWT
// sessions (no DB session store needed for a credentials-only, single-org app).
import NextAuth, { type NextAuthResult } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';
import { prisma } from '@orqafy/db';
import { authConfig } from './auth.config';
import { verifyPassword } from './lib/password';

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Explicit annotations via NextAuthResult: pnpm's nested node_modules make the
// inferred destructured types non-portable (TS2742) otherwise — this is the
// documented Auth.js v5 workaround.
const nextAuth = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (raw) => {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const email = parsed.data.email.trim().toLowerCase();
        const user = await prisma.user.findUnique({ where: { email } });
        if (user === null || !user.isActive) return null;

        const ok = await verifyPassword(parsed.data.password, user.passwordHash);
        if (!ok) return null;

        return { id: user.id, name: user.name, email: user.email };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id !== undefined) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (typeof token.id === 'string') session.user.id = token.id;
      return session;
    },
  },
});

export const handlers: NextAuthResult['handlers'] = nextAuth.handlers;
export const auth: NextAuthResult['auth'] = nextAuth.auth;
export const signIn: NextAuthResult['signIn'] = nextAuth.signIn;
export const signOut: NextAuthResult['signOut'] = nextAuth.signOut;
