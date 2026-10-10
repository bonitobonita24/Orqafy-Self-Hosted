import { describe, expect, it } from 'vitest';
import { canConfirmErase } from './erase-confirm';

describe('canConfirmErase', () => {
  it('false for an empty typed value', () => {
    expect(canConfirmErase('', 'user@orqafy.test')).toBe(false);
  });

  it('false for a partial/prefix match', () => {
    expect(canConfirmErase('user@orqafy', 'user@orqafy.test')).toBe(false);
  });

  it('true for an exact match', () => {
    expect(canConfirmErase('user@orqafy.test', 'user@orqafy.test')).toBe(true);
  });

  it('true when only surrounding whitespace differs', () => {
    expect(canConfirmErase('  user@orqafy.test  ', 'user@orqafy.test')).toBe(true);
  });

  it('false when case differs (case-sensitive, not normalized)', () => {
    expect(canConfirmErase('User@Orqafy.test', 'user@orqafy.test')).toBe(false);
  });

  it('false for a different email entirely', () => {
    expect(canConfirmErase('other@orqafy.test', 'user@orqafy.test')).toBe(false);
  });
});
