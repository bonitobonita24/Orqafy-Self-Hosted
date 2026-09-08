// Route protection (Auth.js v5 edge middleware). Unauthenticated requests are
// bounced to /login except for the public surfaces (login, first-run setup, the
// auth API). First-run detection (redirect to /setup when there are no users) is
// done in the root page (Node RSC) since the edge runtime cannot query the DB.
import NextAuth, { type NextAuthResult } from 'next-auth';
import { NextResponse, type NextMiddleware } from 'next/server';
import { authConfig } from '@/auth.config';

// Annotate to keep the type portable under pnpm (TS2742) — see src/auth.ts.
const auth: NextAuthResult['auth'] = NextAuth(authConfig).auth;

// `/api/trpc` is intentionally public at the EDGE: tRPC enforces its own
// per-procedure auth (protectedProcedure / permissionProcedure throw UNAUTHORIZED
// / FORBIDDEN server-side), so the real authorization boundary is the API layer,
// not this middleware. Gating it here would 307-redirect every API call to the
// HTML /login page — including the public first-run `setup.*` procedures — which
// breaks first-run setup entirely (no user can ever be created).
const PUBLIC_PREFIXES = ['/login', '/setup', '/api/auth', '/api/trpc'];

// The auth() wrapper's return type references a non-portable internal path, so
// the default export is annotated to Next's portable NextMiddleware type.
const middleware = auth((req) => {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const isAuthed = req.auth !== null;

  if (!isAuthed && !isPublic) {
    return NextResponse.redirect(new URL('/login', req.nextUrl.origin));
  }
  return NextResponse.next();
}) as unknown as NextMiddleware;

export default middleware;

export const config = {
  // Run on everything except Next internals and static assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)'],
};
