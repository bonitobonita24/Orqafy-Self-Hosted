// Server-proxied document DOWNLOAD endpoint.
//
// Bytes are streamed back through the app (never a browser-direct presigned
// GET) so every download passes the same permission gate as the rest of the
// documents surface: authenticated, and — for SPI/finance documents (D-20) —
// gated behind `view_finances`. The storage key is read from the DB row, never
// from the client, so a caller can only fetch a document that actually exists.
import { NextResponse } from 'next/server';
import { prisma } from '@orqafy/db';
import { ObjectNotFoundError } from '@orqafy/storage';
import { resolveRequestUserId } from '@/server/request-auth';
import { resolveUserPermissions } from '@/server/permissions';
import { getStorageAdapter } from '@/server/storage';

// Streaming a Buffer/Uint8Array body needs the Node.js runtime.
export const runtime = 'nodejs';

/** Strip anything that could break out of the Content-Disposition header. */
function headerSafeName(name: string): string {
  const ascii = name
    .replace(/["\\]/g, '')
    // eslint-disable-next-line no-control-regex -- intentional C0/DEL strip for header safety
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim();
  return ascii.length > 0 ? ascii : 'download';
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const userId = await resolveRequestUserId(req);
  if (userId === null) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  }

  const { id } = await params;
  const doc = await prisma.document.findUnique({ where: { id } });
  if (doc === null) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  if (doc.isSPI) {
    const permissions = await resolveUserPermissions(userId);
    if (!permissions.has('view_finances')) {
      return NextResponse.json({ error: 'This document is restricted.' }, { status: 403 });
    }
  }

  let object;
  try {
    object = await getStorageAdapter().getObject(doc.storageKey);
  } catch (err) {
    if (err instanceof ObjectNotFoundError) {
      return NextResponse.json({ error: 'File bytes missing.' }, { status: 404 });
    }
    throw err;
  }

  const safeName = headerSafeName(doc.name);
  // Copy into a concrete ArrayBuffer-backed view — a bare Uint8Array<ArrayBufferLike>
  // is not assignable to the DOM BodyInit's ArrayBufferView.
  const responseBody = new Uint8Array(object.body);
  return new NextResponse(responseBody, {
    status: 200,
    headers: {
      'Content-Type': doc.mimeType,
      'Content-Length': String(object.size),
      'Content-Disposition': `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(doc.name)}`,
    },
  });
}
