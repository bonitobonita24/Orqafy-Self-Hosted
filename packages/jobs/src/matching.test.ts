import { describe, expect, it } from 'vitest';

import { matchDocument, guessCategory } from './matching';

const projects = [
  { id: 'p1', code: 'PRJ-017', name: 'Harborfront Tower', clientId: 'c1' },
  { id: 'p2', code: 'PRJ-018', name: 'Riverside Depot', clientId: 'c2' },
];

describe('matchDocument', () => {
  it('auto-files on a single exact code hit', () => {
    const v = matchDocument({ text: 'INVOICE\nProject PRJ-017 amount due', projects });
    expect(v).toMatchObject({ kind: 'auto-file', projectId: 'p1', clientId: 'c1', confidence: 0.95, category: 'invoice' });
  });

  it('routes to review (ambiguous) when two codes match', () => {
    const v = matchDocument({ text: 'PRJ-017 and PRJ-018 both referenced', projects });
    expect(v).toMatchObject({ kind: 'review', suggestedProjectId: 'p1', confidence: 0.5 });
  });

  it('suggests via name match (no code) as review', () => {
    const v = matchDocument({ text: 'delivery for Harborfront Tower site', projects });
    expect(v).toMatchObject({ kind: 'review', suggestedProjectId: 'p1', suggestedClientId: 'c1', confidence: 0.6 });
  });

  it('review with no suggestion when nothing matches', () => {
    const v = matchDocument({ text: 'random unrelated text', projects });
    expect(v).toEqual({ kind: 'review', confidence: 0 });
  });

  it('does not match a code that is only a substring of a larger token', () => {
    const v = matchDocument({ text: 'XPRJ-0179Z', projects });
    expect(v).toMatchObject({ kind: 'review', confidence: 0 });
  });
});

describe('guessCategory', () => {
  it('detects invoice and po', () => {
    expect(guessCategory('This INVOICE is due')).toBe('invoice');
    expect(guessCategory('PURCHASE ORDER 55')).toBe('po');
    expect(guessCategory('hello world')).toBeUndefined();
  });
});
