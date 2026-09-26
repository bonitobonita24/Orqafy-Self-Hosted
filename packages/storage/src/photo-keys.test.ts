// TDD for the site-photo key helpers (D-28). A photo key is derived from a
// client-minted UUID (the mobile outbox idempotency key), so the helper must
// refuse anything that is not a canonical UUID — otherwise a caller could steer
// the object key into another namespace or traverse out of `photos/`.
import { describe, expect, it } from 'vitest';

import { PHOTO_EXTENSIONS, buildPhotoKey, isValidPhotoKey } from './keys';

const UUID = '3f2c9a4e-8b1d-4c7a-9e2f-1a2b3c4d5e6f';

describe('buildPhotoKey', () => {
  it('builds photos/<clientId>/photo.<ext> for a valid UUID', () => {
    expect(buildPhotoKey(UUID, 'jpg')).toBe(`photos/${UUID}/photo.jpg`);
    expect(buildPhotoKey(UUID, 'png')).toBe(`photos/${UUID}/photo.png`);
    expect(buildPhotoKey(UUID, 'heic')).toBe(`photos/${UUID}/photo.heic`);
  });

  it('normalises an upper-case UUID to lower case (one key per photo)', () => {
    expect(buildPhotoKey(UUID.toUpperCase(), 'jpg')).toBe(`photos/${UUID}/photo.jpg`);
  });

  it('rejects a non-UUID clientId', () => {
    expect(() => buildPhotoKey('not-a-uuid', 'jpg')).toThrow();
    expect(() => buildPhotoKey('', 'jpg')).toThrow();
  });

  it('rejects traversal attempts', () => {
    expect(() => buildPhotoKey('../documents/x', 'jpg')).toThrow();
    expect(() => buildPhotoKey(`${UUID}/../../etc`, 'jpg')).toThrow();
    expect(() => buildPhotoKey(`../${UUID}`, 'jpg')).toThrow();
  });

  it('rejects an extension outside the allowlist', () => {
    expect(() => buildPhotoKey(UUID, 'exe' as never)).toThrow();
  });

  it('exposes exactly the allowed extensions', () => {
    expect([...PHOTO_EXTENSIONS]).toEqual(['jpg', 'png', 'heic']);
  });
});

describe('isValidPhotoKey', () => {
  it('accepts the key built for that clientId, for every allowed ext', () => {
    for (const ext of PHOTO_EXTENSIONS) {
      expect(isValidPhotoKey(`photos/${UUID}/photo.${ext}`, UUID)).toBe(true);
    }
  });

  it('rejects a key belonging to another clientId', () => {
    const other = '11111111-2222-4333-8444-555555555555';
    expect(isValidPhotoKey(`photos/${other}/photo.jpg`, UUID)).toBe(false);
  });

  it('rejects foreign namespaces and malformed keys', () => {
    expect(isValidPhotoKey(`documents/${UUID}/photo.jpg`, UUID)).toBe(false);
    expect(isValidPhotoKey(`photos/${UUID}/photo.exe`, UUID)).toBe(false);
    expect(isValidPhotoKey(`photos/${UUID}/../photo.jpg`, UUID)).toBe(false);
    expect(isValidPhotoKey('', UUID)).toBe(false);
  });

  it('returns false (never throws) for a non-UUID clientId', () => {
    expect(isValidPhotoKey('photos/x/photo.jpg', 'x')).toBe(false);
  });
});
