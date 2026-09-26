// Site-photo byte UPLOAD handler (D-28, ORQ-23) — the logic behind
// POST /api/photos, with all I/O injected (`PhotoUploadDeps`) so the rules are
// unit-tested without a DB or object store. The route file only wires real deps.
//
// POST multipart/form-data { file, taskId, clientId }. Order of checks:
//   1. auth (cookie session OR mobile bearer) → 401
//   2. `upload_photo` permission → 403
//   3. task assignee (uniform 403 for missing vs not-yours — no existence leak)
//   4. clientId ownership: a clientId already COMMITTED (a Photo row exists) is
//      immutable — another user's ⇒ uniform 403; the caller's own ⇒ 409 with the
//      existing storageKey (the mobile drain treats that as "already uploaded"
//      and proceeds to photos.create). Only an uncommitted clientId is written,
//      so a pre-commit retry still overwrites its own object (idempotent).
//   5. size + MIME → 413 / 415
// The object key is derived from the client-minted UUID and the MIME type
// (never the filename): `photos/<clientId>/photo.<ext>`.
//
// F4 NOTE — the MIME type is TRUSTED from the multipart part header; there is
// no magic-byte sniff. No byte-serving path for photos exists today. Any future
// serving path MUST either sniff the bytes, or serve with
// `X-Content-Type-Options: nosniff` + `Content-Disposition: attachment`, so an
// HTML/SVG payload uploaded as "image/jpeg" can never render inline.
import type { Permission } from '@orqafy/shared';
import { buildPhotoKey } from '@orqafy/storage';
import {
  PHOTO_FORBIDDEN_MESSAGE,
  PHOTO_MAX_BYTES,
  canAttachPhoto,
  photoExtFromMime,
} from './photo-policy';

export interface PhotoUploadDeps {
  resolveUserId(req: Request): Promise<string | null>;
  resolvePermissions(userId: string): Promise<ReadonlySet<Permission>>;
  findTask(taskId: string): Promise<{ assigneeId: string | null } | null>;
  findPhotoByClientId(clientId: string): Promise<{ capturedBy: string; storageKey: string } | null>;
  putObject(args: { key: string; body: Buffer; contentType: string }): Promise<void>;
}

/** Multipart envelope allowance on top of the file cap for the early length check. */
const ENVELOPE_BYTES = 1024 * 1024;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status: number, headers?: Record<string, string>): Response {
  return Response.json(body, { status, ...(headers === undefined ? {} : { headers }) });
}

function forbidden(): Response {
  return json({ error: PHOTO_FORBIDDEN_MESSAGE }, 403);
}

function tooLarge(): Response {
  return json({ error: `Photo exceeds the ${PHOTO_MAX_BYTES}-byte limit.` }, 413);
}

export async function handlePhotoUpload(req: Request, deps: PhotoUploadDeps): Promise<Response> {
  const userId = await deps.resolveUserId(req);
  if (userId === null) return json({ error: 'Sign in required.' }, 401);

  const permissions = await deps.resolvePermissions(userId);
  if (!permissions.has('upload_photo')) {
    return json({ error: 'Missing permission: upload_photo' }, 403);
  }

  // Cheap early refusal before buffering an obviously oversized body.
  const declared = Number(req.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > PHOTO_MAX_BYTES + ENVELOPE_BYTES) {
    return tooLarge();
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ error: 'Expected multipart/form-data.' }, 400);
  }

  const file = form.get('file');
  const taskId = form.get('taskId');
  const clientIdRaw = form.get('clientId');
  if (typeof taskId !== 'string' || taskId.length === 0) {
    return json({ error: 'taskId is required.' }, 400);
  }
  if (typeof clientIdRaw !== 'string' || !UUID_RE.test(clientIdRaw)) {
    return json({ error: 'clientId must be a UUID.' }, 400);
  }
  const clientId = clientIdRaw.toLowerCase();

  if (!canAttachPhoto(await deps.findTask(taskId), userId)) return forbidden();

  // Committed photos are immutable evidence: never overwrite their bytes.
  const committed = await deps.findPhotoByClientId(clientId);
  if (committed !== null) {
    if (committed.capturedBy !== userId) return forbidden();
    return json({ error: 'Photo already committed', storageKey: committed.storageKey }, 409);
  }

  if (!(file instanceof File) || file.size === 0) {
    return json({ error: 'No file provided.' }, 400);
  }
  if (file.size > PHOTO_MAX_BYTES) return tooLarge();

  const ext = photoExtFromMime(file.type);
  if (ext === null) {
    return json({ error: 'Only JPEG, PNG, or HEIC photos are accepted.' }, 415);
  }

  const key = buildPhotoKey(clientId, ext);
  const body = Buffer.from(await file.arrayBuffer());
  const contentType = file.type.split(';')[0]?.trim().toLowerCase() ?? 'application/octet-stream';
  await deps.putObject({ key, body, contentType });

  return json({ storageKey: key }, 200);
}
