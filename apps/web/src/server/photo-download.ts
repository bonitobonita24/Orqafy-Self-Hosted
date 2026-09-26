// Site-photo byte DOWNLOAD handler (ORQ-32) — the logic behind
// GET /api/photos/[id], with all I/O injected (`PhotoDownloadDeps`) so the
// authorization rules are unit-tested without a DB or object store. The route
// file only wires the real auth, Prisma read, and object storage.
//
// Photo rows carry GPS (lat/lng) and a capturer, so an UNSCOPED read is an IDOR:
// the download rule is the SAME shared policy the metadata reads use
// (canReadStoredPhoto → canViewTaskPhotos / canViewPhotoFeed), so the byte
// surface is never more permissive than what already reveals the photo exists.
//
// No existence oracle: a missing photo, a denied photo, and missing bytes all
// return a byte-identical 404. Only an unauthenticated caller gets 401.
//
// F4 (from photo-upload.ts): the stored MIME is derived from the key we minted,
// never sniffed, so the route MUST serve with `X-Content-Type-Options: nosniff`
// + an inline `Content-Disposition` — an HTML/SVG payload uploaded as
// "image/jpeg" can then never render as active content in the browser.
import type { Permission } from '@orqafy/shared';
import { ObjectNotFoundError } from '@orqafy/storage';
import { canReadStoredPhoto, photoMimeFromKey } from './photo-policy';

/** The photo fields the authorization decision needs — storageKey is read here, never from the client. */
export interface StoredPhoto {
  id: string;
  storageKey: string;
  taskId: string | null;
  task: { assigneeId: string | null } | null;
}

export interface PhotoDownloadDeps {
  resolveUserId(req: Request): Promise<string | null>;
  findPhoto(id: string): Promise<StoredPhoto | null>;
  resolvePermissions(userId: string): Promise<ReadonlySet<Permission>>;
  getObject(key: string): Promise<{ body: Uint8Array; size: number; contentType?: string }>;
}

/** A normalized result the thin route maps to a NextResponse (no Next import here). */
export type PhotoDownloadResult =
  | { status: 401 | 404 | 500; message: string }
  | {
      status: 200;
      body: Uint8Array;
      contentType: string;
      size: number;
      /** Disposition filename base (no extension), e.g. `photo-<id>`. */
      filename: string;
      /** The extension parsed from the stored key, e.g. `jpg`. */
      ext: string;
    };

/** The one 404 for "missing" AND "denied" AND "bytes gone" — no existence leak. */
const NOT_FOUND = { status: 404, message: 'Not found.' } as const;

/** The extension of a stored photo key, constrained to a short alnum token. */
function extFromKey(storageKey: string): string {
  const ext = storageKey.split('.').pop()?.toLowerCase() ?? '';
  return /^[a-z0-9]{1,5}$/.test(ext) ? ext : 'bin';
}

export async function handlePhotoDownload(
  deps: PhotoDownloadDeps,
  { photoId, req }: { photoId: string; req: Request },
): Promise<PhotoDownloadResult> {
  const userId = await deps.resolveUserId(req);
  if (userId === null) return { status: 401, message: 'Unauthorized.' };

  const photo = await deps.findPhoto(photoId);
  const permissions = await deps.resolvePermissions(userId);
  // Missing and denied are byte-identical: never confirm a GPS-bearing row exists
  // to someone who may not read it.
  if (photo === null || !canReadStoredPhoto(photo, userId, permissions)) return NOT_FOUND;

  let obj;
  try {
    obj = await deps.getObject(photo.storageKey);
  } catch (err) {
    if (err instanceof ObjectNotFoundError) return NOT_FOUND;
    return { status: 500, message: 'Failed to read photo.' };
  }

  return {
    status: 200,
    body: obj.body,
    contentType: photoMimeFromKey(photo.storageKey),
    size: obj.size,
    filename: `photo-${photo.id}`,
    ext: extFromKey(photo.storageKey),
  };
}
