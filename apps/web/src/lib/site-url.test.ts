import { describe, expect, it } from 'vitest';
import { resolveSiteUrl } from './site-url';

describe('resolveSiteUrl', () => {
  it('prefers NEXT_PUBLIC_APP_URL when set', () => {
    expect(
      resolveSiteUrl({ NEXT_PUBLIC_APP_URL: 'https://orqafy.example.com', AUTH_URL: 'http://localhost:4000' }),
    ).toBe('https://orqafy.example.com');
  });

  it('falls back to AUTH_URL when NEXT_PUBLIC_APP_URL is unset', () => {
    expect(resolveSiteUrl({ AUTH_URL: 'http://localhost:56483' })).toBe('http://localhost:56483');
  });

  it('falls back to localhost:3000 when neither is set', () => {
    expect(resolveSiteUrl({})).toBe('http://localhost:3000');
  });

  it('normalizes to the origin (strips trailing path)', () => {
    expect(resolveSiteUrl({ AUTH_URL: 'http://localhost:56483/' })).toBe('http://localhost:56483');
  });

  it('falls back to localhost:3000 on an unparsable value', () => {
    expect(resolveSiteUrl({ AUTH_URL: 'not-a-url' })).toBe('http://localhost:3000');
  });
});
