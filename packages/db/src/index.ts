// @orqafy/db — the single Prisma access point for every server-side package.
// Re-exports the generated client types + a lazily-instantiated singleton so
// dev hot-reload never opens a new connection pool per reload.
//
// Layering: this is the ONLY package that imports @prisma/client. The pure
// domain layer (@orqafy/shared) stays database-free (Phase 4 Part 2 rule).
import { PrismaClient } from '@prisma/client';

export * from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
