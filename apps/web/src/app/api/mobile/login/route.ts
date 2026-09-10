// Mobile login endpoint — issues a stateless bearer token (60d, HS256) for the
// Expo app. This MIRRORS the Auth.js Credentials authorize() exactly (zod-parse
// → lowercased email → isActive gate → bcrypt verify) so the cookie path and the
// bearer path cannot diverge. Runs on the Node runtime because bcrypt + Prisma
// are not edge-compatible.
import { z } from 'zod';
import { prisma } from '@orqafy/db';
import { verifyPassword } from '@/lib/password';
import { signMobileToken } from '@/lib/mobile-token';

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
  // TODO: rate-limit this endpoint (per-IP + per-email lockout) before it is
  // reachable beyond localhost — a stateless login has no brute-force protection
  // otherwise. Tracked as a chunk-3a follow-up.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return invalid();
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return invalid();

  const email = parsed.data.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (user === null || !user.isActive) return invalid();

  const ok = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!ok) return invalid();

  const token = await signMobileToken(user.id);
  return Response.json({
    token,
    user: { id: user.id, name: user.name, email: user.email },
  });
}
