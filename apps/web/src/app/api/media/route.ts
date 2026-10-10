// Server-proxied document UPLOAD endpoint.
//
// Files POST here as multipart/form-data; the server streams the bytes to
// storage through the StorageAdapter (no browser-direct presigned PUT), so
// credentials stay server-side and the S3/MinIO/local paths behave identically.
// The response returns the storage key + verified metadata the caller then
// commits via the documents.create tRPC mutation.
//
// Edge middleware does NOT run here (excluded from its matcher — it would cap
// the body at 10 MB, ORQ-31); this handler is the auth boundary.
import { NextResponse } from 'next/server';
import { buildDocumentKey } from '@orqafy/storage';
import { resolveRequestUserId } from '@/server/request-auth';
import { resolveUserPermissions } from '@/server/permissions';
import { getStorageAdapter } from '@/server/storage';

// Buffer + the aws-sdk require the Node.js runtime (not the Edge runtime).
export const runtime = 'nodejs';

/** 50 MiB hard ceiling on a single upload. */
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/**
 * ALLOWLIST (audit M-5 — replaces the prior denylist). A denylist can never
 * enumerate every executable/active-content type; it also trusted the
 * client-declared MIME in isolation, so a relabeled `evil.html` sent as
 * `image/png` sailed through on extension alone. Both the extension AND the
 * MIME type must be in their respective allowlist — html/svg/xml/script are
 * deliberately excluded from both sets, so neither a correctly- nor an
 * incorrectly-labeled active-content file can pass.
 */
const ALLOWED_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tif', '.tiff', '.heic', '.heif', '.avif',
  '.pdf', '.txt', '.csv',
  '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.odt', '.ods', '.odp',
  '.zip',
]);
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp', 'image/tiff',
  'image/heic', 'image/heif', 'image/avif',
  'application/pdf', 'text/plain', 'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
  'application/zip',
  'application/octet-stream',
]);

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot).toLowerCase() : '';
}

/**
 * A file is accepted ONLY if its extension AND its declared MIME type are
 * BOTH in the allowlist. Requiring both blocks a relabel attack either
 * direction: `evil.html` declared as `image/png` fails on extension;
 * `evil.png` declared as `text/html` fails on MIME.
 */
export function isAllowedUpload(name: string, mime: string): boolean {
  return ALLOWED_EXTENSIONS.has(extensionOf(name)) && ALLOWED_MIME_TYPES.has(mime.toLowerCase());
}

function tooLarge(): Response {
  return NextResponse.json(
    { error: `File exceeds the ${MAX_UPLOAD_BYTES}-byte limit.` },
    { status: 413 },
  );
}

/** Thrown by {@link readBodyWithCap} the instant the running total crosses the cap. */
class PayloadTooLargeError extends Error {}

/**
 * Reads the request body as a stream, enforcing `capBytes` WHILE reading
 * instead of after (audit L-1). A lying or missing Content-Length must never
 * let an oversized body be buffered in memory before the limit is checked —
 * so this never calls `req.arrayBuffer()`/`formData()`/`blob()` on the raw,
 * unbounded body. The moment the accumulated byte count exceeds the cap, the
 * reader is cancelled and reading stops.
 */
async function readBodyWithCap(req: Request, capBytes: number): Promise<Buffer> {
  const reader = req.body?.getReader();
  if (reader === undefined) {
    return Buffer.alloc(0);
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > capBytes) {
      // Stop pulling more chunks. Swallow a cancel() rejection — some
      // Request body producers (notably a multipart/FormData-encoded body)
      // throw from their internal source when cancelled mid-stream; that
      // failure is irrelevant here since the body is being discarded anyway.
      reader.cancel().catch(() => {});
      throw new PayloadTooLargeError();
    }
    chunks.push(value);
  }

  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
}

export async function POST(req: Request): Promise<Response> {
  const userId = await resolveRequestUserId(req);
  if (userId === null) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  }

  const permissions = await resolveUserPermissions(userId);
  if (!permissions.has('manage_files')) {
    return NextResponse.json({ error: 'Missing permission: manage_files' }, { status: 403 });
  }

  // Reject an oversized declared Content-Length before touching the body at
  // all (audit L-1). This is an early fast-path only — a missing or
  // understated/lying Content-Length falls through to the bounded stream
  // read below, which is the actual enforcement.
  const declaredRaw = req.headers.get('content-length');
  if (declaredRaw !== null && /^\d+$/.test(declaredRaw.trim())) {
    const declared = Number(declaredRaw.trim());
    if (Number.isSafeInteger(declared) && declared > MAX_UPLOAD_BYTES) {
      return tooLarge();
    }
  }

  let buffered: Buffer;
  try {
    buffered = await readBodyWithCap(req, MAX_UPLOAD_BYTES);
  } catch (err) {
    if (err instanceof PayloadTooLargeError) return tooLarge();
    return NextResponse.json({ error: 'Expected multipart/form-data.' }, { status: 400 });
  }

  // formData() needs a Request to parse the multipart boundary from; the
  // original request's body stream is already fully consumed above, so
  // rebuild one from the bounded buffer instead of re-reading it.
  let form: FormData;
  try {
    form = await new Request(req.url, {
      method: req.method,
      headers: req.headers,
      body: new Uint8Array(buffered),
    }).formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data.' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return tooLarge();
  }

  const mimeType = file.type.length > 0 ? file.type : 'application/octet-stream';
  if (!isAllowedUpload(file.name, mimeType)) {
    return NextResponse.json({ error: 'This file type is not allowed.' }, { status: 400 });
  }

  const key = buildDocumentKey(file.name);
  const body = Buffer.from(await file.arrayBuffer());
  await getStorageAdapter().putObject({ key, body, contentType: mimeType });

  return NextResponse.json({
    storageKey: key,
    size: body.length,
    mimeType,
    name: file.name,
  });
}
