import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { createUuidGenerator } from './uuid';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('createUuidGenerator', () => {
  it('returns RFC-4122 v4 lowercase UUIDs from the injected CSPRNG source', () => {
    const gen = createUuidGenerator(() => randomUUID());
    const ids = new Set(Array.from({ length: 50 }, () => gen()));
    for (const id of ids) expect(id).toMatch(UUID_V4);
    expect(ids.size).toBe(50);
  });

  it('lowercases an uppercase source (iOS NSUUID style)', () => {
    const gen = createUuidGenerator(() => '0F8E4A2B-1C3D-4E5F-9A6B-7C8D9E0F1A2B');
    expect(gen()).toBe('0f8e4a2b-1c3d-4e5f-9a6b-7c8d9e0f1a2b');
  });

  it('throws when no CSPRNG source is provided (never degrades)', () => {
    expect(() => createUuidGenerator(undefined)).toThrow(/CSPRNG/);
  });

  it('throws when the source yields a non-v4 value', () => {
    const gen = createUuidGenerator(() => 'not-a-uuid');
    expect(() => gen()).toThrow(/v4/);
  });

  it('has no Math.random fallback in the id path', () => {
    for (const f of ['./uuid.ts', './uuid-native.ts']) {
      const src = readFileSync(fileURLToPath(new URL(f, import.meta.url)), 'utf8');
      expect(src).not.toMatch(/Math\.random\s*\(/);
    }
  });
});
