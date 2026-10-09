// Server-proxied document DOWNLOAD endpoint.
//
// Bytes are streamed back through the app (never a browser-direct presigned
// GET) so every download passes the same permission gate as the rest of the
// documents surface: authenticated, and — for SPI/finance documents (D-20) —
// gated behind `view_finances`. The storage key is read from the DB row, never
// from the client, so a caller can only fetch a document that actually exists.
//
// Content-Type served to the browser is NEVER the raw client-declared/stored
// value verbatim for an "active content" type (audit M-5): the upload gate
// (apps/web/src/app/api/media/route.ts) now allowlists types, but this route
// is the second, independent layer — a document stored before the allowlist
// (or any mislabeled row) still can't render as HTML/SVG/script in a browser.
// `X-Content-Type-Options: nosniff` + a sandboxed CSP neutralize any script
// that does slip through, and `Content-Disposition: attachment` (unchanged)
// keeps it a download, never an inline render.
import { NextResponse } from 'next/server';
import { prisma } from '@orqafy/db';
import { ObjectNotFoundError } from '@orqafy/storage';
import { resolveRequestUserId } from '@/server/request-auth';
import { resolveUserPermissions } from '@/server/permissions';
import { getStorageAdapter } from '@/server/storage';

// Streaming a Buffer/Uint8Array body needs the Node.js runtime.
export const runtime = 'nodejs';

/**
 * Stored MIME types capable of rendering as active content (HTML/script) if a
 * browser ever renders them inline. These are ALWAYS downgraded to a forced
 * download, regardless of what the DB row says — a relabeled upload or a
 * document stored before the upload allowlist existed must still never
 * execute as a script in the victim's origin.
 */
const RISKY_DOWNLOAD_MIME_TYPES = new Set([
  'text/html',
  'application/xhtml+xml',
  'image/svg+xml',
  'text/xml',
  'application/xml',
  'application/javascript',
  'text/javascript',
]);

/**
 * Resolve the Content-Type to actually SERVE for a downloaded document.
 * Strips any `; charset=...`/parameter suffix before matching so
 * `text/html; charset=utf-8` is caught the same as `text/html`. A risky type
 * is forced to `application/octet-stream` (a plain download, never an
 * inline active-content render); anything else passes through unchanged.
 */
export function safeDownloadContentType(mime: string): string {
  const base = mime.split(';', 1)[0]?.trim().toLowerCase() ?? '';
  return RISKY_DOWNLOAD_MIME_TYPES.has(base) ? 'application/octet-stream' : mime;
}

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
      'Content-Type': safeDownloadContentType(doc.mimeType),
      'Content-Length': String(object.size),
      'Content-Disposition': `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(doc.name)}`,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Cache-Control': 'private, no-store',
    },
  });
}
