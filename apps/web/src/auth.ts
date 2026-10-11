// Auth.js v5 — credentials sign-in against the app's own user table (D-5: NO
// Powerbyte/universal creds; the operator's admin is created at first-run). JWT
// sessions (no DB session store needed for a credentials-only, single-org app).
//
// Brute-force gate (audit H-3): authorize() is a thin wire-up over
// `authorizeCredentials` (server/credentials-auth.ts), which runs the SAME
// rate-limit store/logic the mobile bearer-login route uses — so the cookie
// login path can no longer be brute-forced while the bearer path is guarded.
import NextAuth, { type NextAuthResult } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { prisma } from '@orqafy/db';
import { authConfig } from './auth.config';
import { verifyPassword } from './lib/password';
import { authorizeCredentials } from './server/credentials-auth';
import { getRateLimitStore } from './server/rate-limit';

// Explicit annotations via NextAuthResult: pnpm's nested node_modules make the
// inferred destructured types non-portable (TS2742) otherwise — this is the
// documented Auth.js v5 workaround.
const nextAuth = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: (raw, request) =>
        authorizeCredentials(
          {
            store: getRateLimitStore(),
            findUserByEmail: (email) => prisma.user.findUnique({ where: { email } }),
            verifyPassword,
          },
          raw,
          request,
        ),
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id !== undefined) {
        token.id = user.id;
        // Stamp the IMMUTABLE sign-in time only on an actual sign-in (`user`
        // present). Auth.js v5 re-encodes/rotates the JWT on rolling-session
        // refresh (past `updateAge`), which re-stamps `iat` — so `iat` is NOT
        // safe as a revocation anchor (a continuously-active session would
        // keep getting a fresh `iat` and survive a password change). `authTime`
        // is set once here and never touched again on rotation.
        token.authTime = Math.floor(Date.now() / 1000);
      }
      return token;
    },
    session({ session, token }) {
      if (typeof token.id === 'string') session.user.id = token.id;
      // Expose the immutable sign-in time so the cookie-session path
      // (server/context.ts, server/request-auth.ts) can reject a session
      // issued before the user's last password change (L-2 web) — mirrors the
      // mobile bearer check (server/bearer-identity.ts) using the same
      // `passwordChangedAt` column.
      if (typeof token.authTime === 'number') session.authTime = token.authTime;
      return session;
    },
  },
});

export const handlers: NextAuthResult['handlers'] = nextAuth.handlers;
export const auth: NextAuthResult['auth'] = nextAuth.auth;
export const signIn: NextAuthResult['signIn'] = nextAuth.signIn;
export const signOut: NextAuthResult['signOut'] = nextAuth.signOut;
