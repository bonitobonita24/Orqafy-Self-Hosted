import { describe, expect, it } from 'vitest';
import robots from './robots';

describe('robots() — Rule 35 SEO Foundation', () => {
  it('disallows everything for every user agent (no public surface, D-5)', () => {
    const result = robots();
    expect(result.rules).toEqual({ userAgent: '*', disallow: '/' });
  });
});
