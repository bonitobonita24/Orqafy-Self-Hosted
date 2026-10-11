// Module augmentation: carry the user id on the session + JWT (D-17 context).
import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: { id: string } & DefaultSession['user'];
    /** JWT issue time (unix seconds), copied from the token in the `session` callback (L-2 web). */
    iat?: number;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
  }
}
