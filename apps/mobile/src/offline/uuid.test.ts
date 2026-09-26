import { afterEach, describe, expect, it, vi } from 'vitest';

import { newUuid } from './uuid';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('newUuid', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns an RFC-4122 v4 UUID (server z.string().uuid() clientId)', () => {
    expect(newUuid()).toMatch(UUID_V4);
  });

  it('falls back to a valid v4 UUID when crypto.randomUUID is absent (Hermes)', () => {
    vi.stubGlobal('crypto', undefined);
    const ids = new Set(Array.from({ length: 50 }, () => newUuid()));
    for (const id of ids) expect(id).toMatch(UUID_V4);
    expect(ids.size).toBe(50);
  });
});
