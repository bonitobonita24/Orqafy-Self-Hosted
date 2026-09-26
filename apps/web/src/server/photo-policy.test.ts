// TDD for the pure site-photo policy (D-28): who may attach a photo to a task,
// which MIME types are accepted (and the extension derived from them), and the
// upload size cap. Shared by POST /api/photos and the photos.create mutation so
// the two surfaces can never disagree.
import { describe, expect, it } from 'vitest';
import {
  PHOTO_FORBIDDEN_MESSAGE,
  PHOTO_MAX_BYTES,
  canAttachPhoto,
  photoExtFromMime,
} from './photo-policy';

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
