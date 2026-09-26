// Site-photo policy (D-28, ORQ-23) — the pure rules shared by the byte-upload
// route (POST /api/photos) and the metadata commit (photos.create), so the two
// surfaces can never disagree.
//
//   • Scope: `upload_photo` is deliberately narrow — a holder may attach photos
//     ONLY to tasks assigned to them. A missing task and a task assigned to
//     someone else produce the SAME answer + message (no existence oracle).
//   • Type: the stored extension is derived from the MIME type, never from the
//     client filename; only JPEG / PNG / HEIC are accepted.
import type { PhotoExtension } from '@orqafy/storage';

/** 15 MiB hard ceiling on a single site photo. */
export const PHOTO_MAX_BYTES = 15 * 1024 * 1024;

/** The one message for "missing task" AND "not your task" (no existence leak). */
export const PHOTO_FORBIDDEN_MESSAGE = 'You can only attach photos to tasks assigned to you.';

const MIME_TO_EXT: Readonly<Record<string, PhotoExtension>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
};

/** The storage extension for an allowed image MIME type, or null if refused. */
export function photoExtFromMime(mime: string): PhotoExtension | null {
  const base = mime.split(';')[0]?.trim().toLowerCase() ?? '';
  return MIME_TO_EXT[base] ?? null;
}

/** True only when the task exists AND is assigned to `userId`. */
export function canAttachPhoto(
  task: { assigneeId: string | null } | null,
  userId: string,
): boolean {
  return task !== null && task.assigneeId !== null && task.assigneeId === userId;
}
