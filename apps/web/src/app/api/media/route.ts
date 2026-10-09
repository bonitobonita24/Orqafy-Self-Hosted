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

/** Executable/script types are refused regardless of the rest of the payload. */
const DENIED_EXTENSIONS = new Set(['.exe', '.sh', '.bat', '.js', '.mjs', '.cmd', '.com', '.msi']);
const DENIED_MIME_TYPES = new Set([
  'application/x-msdownload',
  'application/x-msdos-program',
  'application/x-dosexec',
  'application/vnd.microsoft.portable-executable',
  'application/x-executable',
  'application/x-sh',
  'application/x-shellscript',
  'application/x-bat',
  'application/x-msi',
  'application/javascript',
  'text/javascript',
]);

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot).toLowerCase() : '';
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

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `File exceeds the ${MAX_UPLOAD_BYTES}-byte limit.` },
      { status: 413 },
    );
  }

  const mimeType = file.type.length > 0 ? file.type : 'application/octet-stream';
  if (
    DENIED_EXTENSIONS.has(extensionOf(file.name)) ||
    DENIED_MIME_TYPES.has(mimeType.toLowerCase())
  ) {
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
