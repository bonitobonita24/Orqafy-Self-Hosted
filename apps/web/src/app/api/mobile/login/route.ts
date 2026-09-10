// Mobile login endpoint — issues a stateless bearer token (60d, HS256) for the
// Expo app. This MIRRORS the Auth.js Credentials authorize() exactly (zod-parse
// → lowercased email → isActive gate → bcrypt verify) so the cookie path and the
// bearer path cannot diverge. Runs on the Node runtime because bcrypt + Prisma
// are not edge-compatible.
import { z } from 'zod';
import { prisma } from '@orqafy/db';
import { verifyPassword } from '@/lib/password';
import { signMobileToken } from '@/lib/mobile-token';
import {
  checkLoginRateLimit,
  clientIp,
  getRateLimitStore,
  recordLoginFailure,
  recordLoginSuccess,
} from '@/server/rate-limit';

export const runtime = 'nodejs';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Uniform 401 — NEVER distinguish "no such user" from "wrong password"
// (prevents user-enumeration; security.md — generic auth error).
function invalid(): Response {
  return Response.json({ error: 'Invalid credentials' }, { status: 401 });
}

export async function POST(req: Request): Promise<Response> {
  const store = getRateLimitStore();
  const ip = clientIp(req);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return invalid();
  }

  const parsed = loginSchema.safeParse(body);
  const email = parsed.success ? parsed.data.email.trim().toLowerCase() : null;

  // Brute-force gate BEFORE any DB work (per-IP always, per-email on failures).
  const rl = await checkLoginRateLimit(store, { ip, email });
  if (!rl.allowed) {
    return Response.json(
      { error: 'Too many attempts' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
    );
  }

  if (!parsed.success || email === null) return invalid();

  const user = await prisma.user.findUnique({ where: { email } });
  if (user === null || !user.isActive) {
    await recordLoginFailure(store, email);
    return invalid();
  }

  const ok = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!ok) {
    await recordLoginFailure(store, email);
    return invalid();
  }

  // Success — clear the email failure counter (email is non-null here).
  await recordLoginSuccess(store, email);

  const token = await signMobileToken(user.id);
  return Response.json({
    token,
    user: { id: user.id, name: user.name, email: user.email },
  });
}
