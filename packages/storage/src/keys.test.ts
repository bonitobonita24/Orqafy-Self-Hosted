// TDD for the pure document-key helper. The key is the ONLY thing the upload
// path derives from an attacker-controlled filename, so its safety (no path
// traversal, no separators, no empty/dot-only segment) is unit-pinned here.
import { describe, expect, it } from 'vitest';

import { buildDocumentKey } from './keys';

/** Every key must be exactly `documents/<id>/<name>` with three clean segments. */
function segments(key: string): string[] {
  return key.split('/');
}

/** True if the string contains any C0 control char or DEL. */
function hasControlChar(input: string): boolean {
  return [...input].some((ch) => {
    const code = ch.codePointAt(0) ?? 0;
    return code < 0x20 || code === 0x7f;
  });
}

describe('buildDocumentKey', () => {
  it('produces a three-segment documents/<id>/<name> key for a normal name', () => {
    const key = buildDocumentKey('report.pdf');
    const parts = segments(key);
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe('documents');
    expect(parts[1]?.length).toBeGreaterThan(0);
    expect(parts[2]).toBe('report.pdf');
  });

  it('strips a ../ traversal attempt down to the basename', () => {
    const key = buildDocumentKey('../../etc/passwd');
    const parts = segments(key);
    expect(parts).toHaveLength(3);
    expect(parts[2]).toBe('passwd');
    // No segment may be a traversal token.
    expect(parts).not.toContain('..');
    expect(parts).not.toContain('.');
  });

  it('drops embedded forward-slash path separators (keeps last segment only)', () => {
    const key = buildDocumentKey('folder/sub/invoice.png');
    const parts = segments(key);
    expect(parts).toHaveLength(3);
    expect(parts[2]).toBe('invoice.png');
  });

  it('drops embedded backslash separators too', () => {
    const key = buildDocumentKey('C:\\Windows\\System32\\drawing.dwg');
    const parts = segments(key);
    expect(parts).toHaveLength(3);
    expect(parts[2]).toBe('drawing.dwg');
  });

  it('removes control characters and collapses whitespace', () => {
    const key = buildDocumentKey('my\u0000\u0001  scan\tphoto\n.jpg');
    const parts = segments(key);
    expect(parts).toHaveLength(3);
    const name = parts[2] ?? '';
    // No control chars survive (scan code points, not a control-char regex).
    expect(hasControlChar(name)).toBe(false);
    // No whitespace runs survive.
    expect(/\s{2,}/.test(name)).toBe(false);
    expect(name).toContain('scan');
    expect(name).toContain('photo');
    expect(name.endsWith('.jpg')).toBe(true);
  });

  it('falls back to a safe name for an empty input', () => {
    const key = buildDocumentKey('');
    const parts = segments(key);
    expect(parts).toHaveLength(3);
    expect(parts[2]?.length).toBeGreaterThan(0);
  });

  it('falls back to a safe name for a dot-only / traversal-only input', () => {
    for (const evil of ['..', '.', '...', '/', '\\', '   ']) {
      const parts = segments(buildDocumentKey(evil));
      expect(parts).toHaveLength(3);
      const name = parts[2] ?? '';
      expect(name.length).toBeGreaterThan(0);
      expect(name).not.toBe('..');
      expect(name).not.toBe('.');
    }
  });

  it('caps a very long name to a bounded segment length', () => {
    const key = buildDocumentKey('a'.repeat(500) + '.pdf');
    const parts = segments(key);
    expect(parts).toHaveLength(3);
    const name = parts[2] ?? '';
    expect(name.length).toBeGreaterThan(0);
    expect(name.length).toBeLessThanOrEqual(128);
  });

  it('never yields a traversal-capable name segment', () => {
    for (const evil of ['../../../root', '..\\..\\secret', './../x', 'a/../../b']) {
      const parts = segments(buildDocumentKey(evil));
      expect(parts).toHaveLength(3);
      expect(parts[2]).not.toContain('/');
      expect(parts[2]).not.toContain('\\');
      expect(parts[2]).not.toBe('..');
    }
  });

  it('generates a unique id segment per call', () => {
    const a = segments(buildDocumentKey('x.pdf'))[1];
    const b = segments(buildDocumentKey('x.pdf'))[1];
    expect(a).not.toBe(b);
  });
});
