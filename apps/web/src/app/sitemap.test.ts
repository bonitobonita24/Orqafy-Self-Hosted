import { describe, expect, it } from 'vitest';
import sitemap from './sitemap';

describe('sitemap() — Rule 35 SEO Foundation', () => {
  it('is intentionally empty (no indexable public route exists, D-5)', () => {
    expect(sitemap()).toEqual([]);
  });
});
