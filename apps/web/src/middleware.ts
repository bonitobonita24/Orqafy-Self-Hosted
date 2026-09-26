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
// `/api/mobile` (the mobile login endpoint) is public at the EDGE: it
// authenticates by definition (email + password → bearer token), so the edge
// must not 307-redirect it to the HTML /login page.
// The byte-upload/download routes `/api/photos` and `/api/media` (+ `/api/media/[id]`)
// are NOT listed here: they are excluded from the matcher entirely (see `config`
// below) because middleware caps request bodies at 10 MB (ORQ-31).
const PUBLIC_PREFIXES = ['/login', '/setup', '/api/auth', '/api/trpc', '/api/mobile'];

// The auth() wrapper's return type references a non-portable internal path, so
// the default export is annotated to Next's portable NextMiddleware type.
const middleware = auth((req) => {
  const { pathname } = req.nextUrl;
  // The root `/` is always allowed through to its Node RSC (app/page.tsx). That
  // RSC does the DB-backed FIRST-RUN routing the edge runtime cannot: 0 users →
  // /setup, otherwise unauthenticated → /login, else → /dashboard. Without this
  // exception the edge would bounce `/` → /login before the RSC runs, so a fresh
  // install could never reach /setup (the first-run entry redirect bug).
  const isRoot = pathname === '/';
  const isPublic =
    isRoot || PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const isAuthed = req.auth !== null;

  if (!isAuthed && !isPublic) {
    return NextResponse.redirect(new URL('/login', req.nextUrl.origin));
  }
  return NextResponse.next();
}) as unknown as NextMiddleware;

export default middleware;

export const config = {
  // Run on everything except Next internals, static assets, and the upload
  // routes. ORQ-31: whenever middleware runs, Next clones + buffers the request
  // body and keeps only the first `experimental.middlewareClientMaxBodySize`
  // bytes (default 10 MB) — the rest is dropped without an error, so a 12 MiB
  // photo reached /api/photos truncated (→ 400) and >10 MB documents broke
  // /api/media. Those handlers authenticate themselves (photos: cookie OR
  // bearer + upload_photo + assignee; media: auth() + manage_files; media/[id]:
  // auth() + view_finances for SPI) and this middleware adds no headers, so
  // they lose nothing by skipping it. Unauthenticated callers now get a JSON
  // 401 from the handler instead of a 307 to the HTML /login page.
  // `(?:/|$)` keeps look-alikes such as /api/photosX on the middleware.
  // Regression test: src/middleware.test.ts. Must stay a static literal (Next
  // parses it at build time).
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/photos(?:/|$)|api/media(?:/|$)|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)',
  ],
};
