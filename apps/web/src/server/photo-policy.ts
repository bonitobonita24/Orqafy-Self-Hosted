// Site-photo policy (D-28, ORQ-23) — the pure rules shared by the byte-upload
// route (POST /api/photos) and the metadata commit (photos.create), so the two
// surfaces can never disagree.
//
//   • Scope: `upload_photo` is deliberately narrow — a holder may attach photos
//     ONLY to tasks assigned to them. A missing task and a task assigned to
//     someone else produce the SAME answer + message (no existence oracle).
//   • Type: the stored extension is derived from the MIME type, never from the
//     client filename; only JPEG / PNG / HEIC are accepted.
//   • Read: photo rows carry GPS, so reading them is assignee-OR-oversight
//     (canViewTaskPhotos); a cross-task feed is oversight-only (canViewPhotoFeed).
import type { Permission } from '@orqafy/shared';
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

/**
 * Permission atoms that mean "oversees projects" — a holder may read photo rows
 * (GPS, capturer) on tasks NOT assigned to them.
 *
 * Choice (F2): both atoms are held by owner_admin and project_manager and by
 * NEITHER field_staff, accountant, nor client:
 *   • view_all_projects — the semantic "oversight" atom, granted to owner_admin
 *     + project_manager.
 *   • create_project    — kept as belt-and-suspenders. The old seed-vs-roles.ts
 *     drift (the db seed's project_manager once lacked view_all_projects) is now
 *     RESOLVED: ORQ-27 made @orqafy/shared/roles the ONE grant source both the
 *     seed and the web first-run consume, so PM holds view_all_projects in both.
 *     create_project stays here as a redundant guard, not a drift workaround.
 * manage_files / export_data are deliberately excluded: the accountant holds
 * them, and file/export rights are not site oversight.
 */
export const PHOTO_OVERSIGHT_PERMISSIONS: readonly Permission[] = [
  'view_all_projects',
  'create_project',
];

function hasPhotoOversight(permissions: ReadonlySet<Permission>): boolean {
  return PHOTO_OVERSIGHT_PERMISSIONS.some((p) => permissions.has(p));
}

/** May `userId` read the photo rows of this task? Assignee OR oversight. */
export function canViewTaskPhotos(
  task: { assigneeId: string | null } | null,
  userId: string,
  permissions: ReadonlySet<Permission>,
): boolean {
  if (task === null) return false;
  if (task.assigneeId !== null && task.assigneeId === userId) return true;
  return hasPhotoOversight(permissions);
}

/** May the caller see a cross-task photo feed (e.g. the dashboard)? Oversight only. */
export function canViewPhotoFeed(permissions: ReadonlySet<Permission>): boolean {
  return hasPhotoOversight(permissions);
}

/**
 * The image MIME type for a stored photo key (`photos/<id>/photo.<ext>`), derived
 * from the trailing extension of the key we ourselves minted (never the client).
 * Only the three stored extensions map to an image type; anything else falls back
 * to `application/octet-stream` so an unexpected object can never be served as an
 * inline image (belt-and-suspenders with the route's `nosniff`).
 */
export function photoMimeFromKey(storageKey: string): string {
  const ext = storageKey.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'heic':
      return 'image/heic';
    default:
      return 'application/octet-stream';
  }
}

/**
 * May `userId` read the BYTES of a stored photo? Identical scoping to the
 * `tasks.byId` / dashboard metadata reads so the download surface can never be
 * more permissive than what already shows the photo's existence:
 *   • task-attached photo → assignee OR oversight (canViewTaskPhotos)
 *   • milestone-only / orphan photo → oversight only (canViewPhotoFeed)
 * No capturer-only special case: consistency across surfaces is the point (a
 * field_staff who is not the assignee cannot read another user's GPS-bearing
 * photo just because they captured it, matching canViewTaskPhotos).
 */
export function canReadStoredPhoto(
  photo: { taskId: string | null; task: { assigneeId: string | null } | null },
  userId: string,
  permissions: ReadonlySet<Permission>,
): boolean {
  if (photo.taskId !== null) return canViewTaskPhotos(photo.task, userId, permissions);
  return canViewPhotoFeed(permissions);
}

/** True only when the task exists AND is assigned to `userId`. */
export function canAttachPhoto(
  task: { assigneeId: string | null } | null,
  userId: string,
): boolean {
  return task !== null && task.assigneeId !== null && task.assigneeId === userId;
}
