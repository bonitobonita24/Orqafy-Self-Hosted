// Module augmentation: carry the user id on the session + JWT (D-17 context).
import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: { id: string } & DefaultSession['user'];
    /**
     * Immutable sign-in time (unix seconds), stamped once in the `jwt`
     * callback on actual sign-in and copied through in the `session`
     * callback (L-2 web). Deliberately NOT the JWT's `iat` — Auth.js v5
     * re-stamps `iat` on rolling-session rotation, so `iat` cannot anchor
     * password-change revocation.
     */
    authTime?: number;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    /** Immutable sign-in time (unix seconds), set once on sign-in — never refreshed on rotation. */
    authTime?: number;
  }
}
