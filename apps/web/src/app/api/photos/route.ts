// Site-photo byte UPLOAD endpoint (D-28, ORQ-23).
//
// POST multipart/form-data { file, taskId, clientId }. Authenticates via EITHER
// the Auth.js cookie session or the mobile bearer token (server/request-auth),
// requires the narrow `upload_photo` permission, AND requires the caller to be
// the task's assignee (uniform 403 for missing-task vs not-assignee — no
// existence leak). The object key is derived from the client-minted UUID and
// the MIME type (never the filename): `photos/<clientId>/photo.<ext>`, so a
// retried upload overwrites the same object (idempotent). The caller then
// commits the metadata row via the photos.create tRPC mutation.
//
// The edge middleware lets /api/photos through unauthenticated (a bearer-only
// mobile request carries no cookie); THIS handler is the auth boundary.
import { NextResponse } from 'next/server';
import { prisma } from '@orqafy/db';
import { buildPhotoKey } from '@orqafy/storage';
import { resolveRequestUserId } from '@/server/request-auth';
import { resolveUserPermissions } from '@/server/permissions';
import { getStorageAdapter } from '@/server/storage';
import {
  PHOTO_FORBIDDEN_MESSAGE,
  PHOTO_MAX_BYTES,
  canAttachPhoto,
  photoExtFromMime,
} from '@/server/photo-policy';

// Buffer + the aws-sdk require the Node.js runtime (not the Edge runtime).
export const runtime = 'nodejs';

/** Multipart envelope allowance on top of the file cap for the early length check. */
const ENVELOPE_BYTES = 1024 * 1024;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function forbidden(): Response {
  return NextResponse.json({ error: PHOTO_FORBIDDEN_MESSAGE }, { status: 403 });
}

export async function POST(req: Request): Promise<Response> {
  const userId = await resolveRequestUserId(req);
  if (userId === null) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  }

  const permissions = await resolveUserPermissions(userId);
  if (!permissions.has('upload_photo')) {
    return NextResponse.json({ error: 'Missing permission: upload_photo' }, { status: 403 });
  }

  // Cheap early refusal before buffering an obviously oversized body.
  const declared = Number(req.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > PHOTO_MAX_BYTES + ENVELOPE_BYTES) {
    return NextResponse.json(
      { error: `Photo exceeds the ${PHOTO_MAX_BYTES}-byte limit.` },
      { status: 413 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data.' }, { status: 400 });
  }

  const file = form.get('file');
  const taskId = form.get('taskId');
  const clientIdRaw = form.get('clientId');
  if (typeof taskId !== 'string' || taskId.length === 0) {
    return NextResponse.json({ error: 'taskId is required.' }, { status: 400 });
  }
  if (typeof clientIdRaw !== 'string' || !UUID_RE.test(clientIdRaw)) {
    return NextResponse.json({ error: 'clientId must be a UUID.' }, { status: 400 });
  }
  const clientId = clientIdRaw.toLowerCase();

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { assigneeId: true },
  });
  if (!canAttachPhoto(task, userId)) return forbidden();

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
  }
  if (file.size > PHOTO_MAX_BYTES) {
    return NextResponse.json(
      { error: `Photo exceeds the ${PHOTO_MAX_BYTES}-byte limit.` },
      { status: 413 },
    );
  }

  const ext = photoExtFromMime(file.type);
  if (ext === null) {
    return NextResponse.json(
      { error: 'Only JPEG, PNG, or HEIC photos are accepted.' },
      { status: 415 },
    );
  }

  const key = buildPhotoKey(clientId, ext);
  const body = Buffer.from(await file.arrayBuffer());
  const contentType = file.type.split(';')[0]?.trim().toLowerCase() ?? 'application/octet-stream';
  await getStorageAdapter().putObject({ key, body, contentType });

  return NextResponse.json({ storageKey: key });
}
