// Unit tests for the pure config helpers (chunk 5 hardening).
import { describe, expect, it } from 'vitest';

import { isInsecureRemote } from './config';

describe('isInsecureRemote', () => {
  it('flags a non-local host over http (LAN IP)', () => {
    expect(isInsecureRemote('http://192.168.1.10:56483')).toBe(true);
  });

  it('flags a non-local host over http (domain)', () => {
    expect(isInsecureRemote('http://example.com')).toBe(true);
  });

  it('allows localhost over http', () => {
    expect(isInsecureRemote('http://localhost:56483')).toBe(false);
  });

  it('allows 127.0.0.1 over http', () => {
    expect(isInsecureRemote('http://127.0.0.1:9')).toBe(false);
  });

  it('allows any https host', () => {
    expect(isInsecureRemote('https://example.com')).toBe(false);
  });
});
