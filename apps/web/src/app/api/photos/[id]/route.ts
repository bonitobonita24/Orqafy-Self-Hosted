// Site-photo byte DOWNLOAD endpoint (ORQ-32). All rules live in
// server/photo-download.ts (unit-tested with injected deps); this file only
// wires the real auth (cookie OR mobile bearer), the Prisma read, and object
// storage. See that module for the SAME-AS-metadata scoping and the uniform-404
// no-existence-oracle rule (photo rows carry GPS → an unscoped read is IDOR).
//
// The edge middleware does NOT run on /api/photos/[id] (excluded by the matcher's
// `api/photos(?:/|$)` group — the `(?:/|$)` covers this subpath), so THIS handler
// is the auth boundary. Bytes are served with `X-Content-Type-Options: nosniff`
// + an inline Content-Disposition so a mistyped upload can never render as active
// content. The storage key is read only from the DB row, never the client.
import { NextResponse } from 'next/server';
import { prisma } from '@orqafy/db';
import { resolveRequestUserId } from '@/server/request-auth';
import { resolveUserPermissions } from '@/server/permissions';
import { getStorageAdapter } from '@/server/storage';
import { handlePhotoDownload } from '@/server/photo-download';

// Streaming a Uint8Array body + the aws-sdk require the Node.js runtime.
export const runtime = 'nodejs';

/** Strip anything that could break out of the Content-Disposition header. */
function headerSafeName(name: string): string {
  const ascii = name
    .replace(/["\\]/g, '')
    // eslint-disable-next-line no-control-regex -- intentional C0/DEL strip for header safety
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim();
  return ascii.length > 0 ? ascii : 'photo';
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  const result = await handlePhotoDownload(
    {
      resolveUserId: resolveRequestUserId,
      findPhoto: (photoId) =>
        prisma.photo.findUnique({
          where: { id: photoId },
          select: {
            id: true,
            storageKey: true,
            taskId: true,
            task: { select: { assigneeId: true } },
          },
        }),
      resolvePermissions: resolveUserPermissions,
      getObject: (key) => getStorageAdapter().getObject(key),
    },
    { photoId: id, req },
  );

  if (result.status !== 200) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }

  const safeName = headerSafeName(result.filename);
  // Copy into a concrete ArrayBuffer-backed view — a bare Uint8Array<ArrayBufferLike>
  // is not assignable to the DOM BodyInit's ArrayBufferView.
  const responseBody = new Uint8Array(result.body);
  return new NextResponse(responseBody, {
    status: 200,
    headers: {
      'Content-Type': result.contentType,
      'Content-Length': String(result.size),
      'Content-Disposition': `inline; filename="${safeName}.${result.ext}"`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    },
  });
}
