// TDD for the pure site-photo policy (D-28): who may attach a photo to a task,
// which MIME types are accepted (and the extension derived from them), and the
// upload size cap. Shared by POST /api/photos and the photos.create mutation so
// the two surfaces can never disagree.
import { describe, expect, it } from 'vitest';
import type { Permission } from '@orqafy/shared';
import {
  PHOTO_FORBIDDEN_MESSAGE,
  PHOTO_MAX_BYTES,
  canAttachPhoto,
  canReadStoredPhoto,
  canViewPhotoFeed,
  canViewTaskPhotos,
  photoExtFromMime,
  photoMimeFromKey,
} from './photo-policy';
import { SYSTEM_ROLE_PERMISSIONS } from './roles';

describe('canAttachPhoto', () => {
  it('allows the task assignee', () => {
    expect(canAttachPhoto({ assigneeId: 'u1' }, 'u1')).toBe(true);
  });

  it('denies a user who is not the assignee', () => {
    expect(canAttachPhoto({ assigneeId: 'u2' }, 'u1')).toBe(false);
  });

  it('denies an unassigned task', () => {
    expect(canAttachPhoto({ assigneeId: null }, 'u1')).toBe(false);
  });

  it('denies a missing task (same answer as not-assignee — no existence leak)', () => {
    expect(canAttachPhoto(null, 'u1')).toBe(false);
  });
});

describe('photoExtFromMime', () => {
  it('maps the three allowed image types', () => {
    expect(photoExtFromMime('image/jpeg')).toBe('jpg');
    expect(photoExtFromMime('image/png')).toBe('png');
    expect(photoExtFromMime('image/heic')).toBe('heic');
  });

  it('is case-insensitive and ignores MIME parameters', () => {
    expect(photoExtFromMime('IMAGE/JPEG')).toBe('jpg');
    expect(photoExtFromMime('image/png; charset=binary')).toBe('png');
  });

  it('rejects anything else', () => {
    expect(photoExtFromMime('image/svg+xml')).toBeNull();
    expect(photoExtFromMime('image/gif')).toBeNull();
    expect(photoExtFromMime('application/octet-stream')).toBeNull();
    expect(photoExtFromMime('')).toBeNull();
  });
});

describe('constants', () => {
  it('caps uploads at 15 MiB', () => {
    expect(PHOTO_MAX_BYTES).toBe(15 * 1024 * 1024);
  });

  it('has a single uniform forbidden message', () => {
    expect(PHOTO_FORBIDDEN_MESSAGE.length).toBeGreaterThan(0);
  });
});

// F2: photo rows carry GPS + storageKey, so reading them is assignee-or-oversight.
// The matrix runs against BOTH role-grant sources (first-run roles.ts AND the db
// seed, which currently drift for project_manager — see docs/TASK_QUEUE.md).
const SEED_PROJECT_MANAGER: Permission[] = ['create_project', 'manage_files', 'upload_photo'];
const perms = (list: readonly Permission[]): ReadonlySet<Permission> => new Set(list);
const TASK = { assigneeId: 'assignee' };

describe('canViewTaskPhotos', () => {
  it('allows the task assignee even with no oversight atom', () => {
    expect(canViewTaskPhotos(TASK, 'assignee', perms(SYSTEM_ROLE_PERMISSIONS.field_staff))).toBe(
      true,
    );
  });

  it('allows owner_admin (non-assignee)', () => {
    expect(canViewTaskPhotos(TASK, 'boss', perms(SYSTEM_ROLE_PERMISSIONS.owner_admin))).toBe(true);
  });

  it('allows project_manager (non-assignee) under both roles.ts and seed grants', () => {
    expect(canViewTaskPhotos(TASK, 'pm', perms(SYSTEM_ROLE_PERMISSIONS.project_manager))).toBe(
      true,
    );
    expect(canViewTaskPhotos(TASK, 'pm', perms(SEED_PROJECT_MANAGER))).toBe(true);
  });

  it('denies field_staff who is not the assignee', () => {
    expect(canViewTaskPhotos(TASK, 'other', perms(SYSTEM_ROLE_PERMISSIONS.field_staff))).toBe(
      false,
    );
  });

  it('denies the client role', () => {
    expect(canViewTaskPhotos(TASK, 'c', perms(SYSTEM_ROLE_PERMISSIONS.client))).toBe(false);
  });

  it('denies the accountant role (manage_files/export_data are not oversight)', () => {
    expect(canViewTaskPhotos(TASK, 'acct', perms(SYSTEM_ROLE_PERMISSIONS.accountant))).toBe(false);
  });

  it('denies a missing task and never matches a null assignee', () => {
    expect(canViewTaskPhotos(null, 'assignee', perms([]))).toBe(false);
    expect(canViewTaskPhotos({ assigneeId: null }, 'x', perms([]))).toBe(false);
  });
});

describe('canViewPhotoFeed (cross-task feed, e.g. dashboard)', () => {
  it('is oversight-only', () => {
    expect(canViewPhotoFeed(perms(SYSTEM_ROLE_PERMISSIONS.owner_admin))).toBe(true);
    expect(canViewPhotoFeed(perms(SYSTEM_ROLE_PERMISSIONS.project_manager))).toBe(true);
    expect(canViewPhotoFeed(perms(SEED_PROJECT_MANAGER))).toBe(true);
    expect(canViewPhotoFeed(perms(SYSTEM_ROLE_PERMISSIONS.field_staff))).toBe(false);
    expect(canViewPhotoFeed(perms(SYSTEM_ROLE_PERMISSIONS.accountant))).toBe(false);
    expect(canViewPhotoFeed(perms(SYSTEM_ROLE_PERMISSIONS.client))).toBe(false);
  });
});

// ORQ-32: the byte-download rule. A task-attached photo scopes exactly like
// canViewTaskPhotos (assignee OR oversight); a milestone-only / orphan photo is
// oversight-only. Same policy the tasks.byId metadata read uses — the byte route
// is never more permissive than what already reveals the photo exists.
describe('canReadStoredPhoto', () => {
  const taskPhoto = { taskId: 't1', task: { assigneeId: 'assignee' } };
  const orphanPhoto = { taskId: null, task: null };

  it('allows the task assignee (no oversight atom)', () => {
    expect(
      canReadStoredPhoto(taskPhoto, 'assignee', perms(SYSTEM_ROLE_PERMISSIONS.field_staff)),
    ).toBe(true);
  });

  it('allows an oversight holder who is not the assignee', () => {
    expect(canReadStoredPhoto(taskPhoto, 'boss', perms(SYSTEM_ROLE_PERMISSIONS.owner_admin))).toBe(
      true,
    );
    expect(canReadStoredPhoto(taskPhoto, 'pm', perms(SYSTEM_ROLE_PERMISSIONS.project_manager))).toBe(
      true,
    );
  });

  it('denies a non-assignee, non-oversight user (field_staff, accountant, client)', () => {
    expect(
      canReadStoredPhoto(taskPhoto, 'stranger', perms(SYSTEM_ROLE_PERMISSIONS.field_staff)),
    ).toBe(false);
    expect(canReadStoredPhoto(taskPhoto, 'acct', perms(SYSTEM_ROLE_PERMISSIONS.accountant))).toBe(
      false,
    );
    expect(canReadStoredPhoto(taskPhoto, 'c', perms(SYSTEM_ROLE_PERMISSIONS.client))).toBe(false);
  });

  it('a milestone-only / orphan photo is oversight-only (no assignee shortcut)', () => {
    expect(canReadStoredPhoto(orphanPhoto, 'boss', perms(SYSTEM_ROLE_PERMISSIONS.owner_admin))).toBe(
      true,
    );
    expect(
      canReadStoredPhoto(orphanPhoto, 'assignee', perms(SYSTEM_ROLE_PERMISSIONS.field_staff)),
    ).toBe(false);
  });
});

describe('photoMimeFromKey', () => {
  const uuid = '3f2c9a4e-8b1d-4c7a-9e2f-1a2b3c4d5e6f';
  it('maps the stored photo extensions to image MIME types', () => {
    expect(photoMimeFromKey(`photos/${uuid}/photo.jpg`)).toBe('image/jpeg');
    expect(photoMimeFromKey(`photos/${uuid}/photo.jpeg`)).toBe('image/jpeg');
    expect(photoMimeFromKey(`photos/${uuid}/photo.png`)).toBe('image/png');
    expect(photoMimeFromKey(`photos/${uuid}/photo.heic`)).toBe('image/heic');
  });

  it('is case-insensitive on the extension', () => {
    expect(photoMimeFromKey(`photos/${uuid}/photo.JPG`)).toBe('image/jpeg');
  });

  it('falls back to application/octet-stream for anything unexpected', () => {
    expect(photoMimeFromKey(`photos/${uuid}/photo.svg`)).toBe('application/octet-stream');
    expect(photoMimeFromKey('photos/no-extension')).toBe('application/octet-stream');
    expect(photoMimeFromKey('')).toBe('application/octet-stream');
  });
});
