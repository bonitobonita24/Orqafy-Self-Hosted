// Site-photo byte UPLOAD endpoint (D-28, ORQ-23). All rules live in
// server/photo-upload.ts (unit-tested with injected deps); this file only wires
// the real auth, Prisma reads, and object storage. See that module for the
// check order, the committed-photo immutability rule (403/409), and the F4
// note on MIME trust (any future photo-serving path must sniff bytes or serve
// with `X-Content-Type-Options: nosniff` + `Content-Disposition: attachment`).
//
// The edge middleware does not run on /api/photos at all (excluded from its
// matcher: a bearer-only mobile request carries no cookie, and middleware caps
// bodies at 10 MB — ORQ-31); THIS handler is the auth boundary.
import { prisma } from '@orqafy/db';
import { resolveRequestUserId } from '@/server/request-auth';
import { resolveUserPermissions } from '@/server/permissions';
import { getStorageAdapter } from '@/server/storage';
import { handlePhotoUpload } from '@/server/photo-upload';
import { checkPhotoUploadRateLimit, getRateLimitStore } from '@/server/rate-limit';

// Buffer + the aws-sdk require the Node.js runtime (not the Edge runtime).
export const runtime = 'nodejs';

export function POST(req: Request): Promise<Response> {
  return handlePhotoUpload(req, {
    rateLimit: (userId) => checkPhotoUploadRateLimit(getRateLimitStore(), userId),
    resolveUserId: resolveRequestUserId,
    resolvePermissions: resolveUserPermissions,
    findTask: (id) => prisma.task.findUnique({ where: { id }, select: { assigneeId: true } }),
    findPhotoByClientId: (clientId) =>
      prisma.photo.findUnique({
        where: { clientId },
        select: { capturedBy: true, storageKey: true },
      }),
    putObject: async (args) => {
      await getStorageAdapter().putObject(args);
    },
  });
}
