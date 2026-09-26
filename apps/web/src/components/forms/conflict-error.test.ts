import { describe, expect, it } from 'vitest';
import { conflictMessage, isConflictError, FILE_CONFLICT_MESSAGE } from './conflict-error';

describe('isConflictError', () => {
  it('is true for a tRPC CONFLICT error', () => {
    expect(isConflictError({ data: { code: 'CONFLICT' } })).toBe(true);
  });

  it('is false for other tRPC error codes', () => {
    expect(isConflictError({ data: { code: 'BAD_REQUEST' } })).toBe(false);
    expect(isConflictError({ data: { code: 'INTERNAL_SERVER_ERROR' } })).toBe(false);
    expect(isConflictError({ data: { code: 'FORBIDDEN' } })).toBe(false);
  });

  it('is false for null / undefined / missing shape (caught unknown values)', () => {
    expect(isConflictError(null)).toBe(false);
    expect(isConflictError(undefined)).toBe(false);
    expect(isConflictError({})).toBe(false);
    expect(isConflictError({ data: null })).toBe(false);
    expect(isConflictError({ data: {} })).toBe(false);
    expect(isConflictError('CONFLICT')).toBe(false);
    expect(isConflictError(new Error('boom'))).toBe(false);
  });
});

describe('conflictMessage', () => {
  it('returns the friendly guidance for a CONFLICT', () => {
    expect(conflictMessage({ data: { code: 'CONFLICT' } })).toBe(FILE_CONFLICT_MESSAGE);
  });

  it('returns null for non-conflict errors so generic handling is kept', () => {
    expect(conflictMessage({ data: { code: 'BAD_REQUEST' } })).toBeNull();
    expect(conflictMessage(null)).toBeNull();
    expect(conflictMessage(undefined)).toBeNull();
  });

  it('the message is actionable — it tells the user to choose the file again', () => {
    expect(FILE_CONFLICT_MESSAGE.toLowerCase()).toContain('again');
  });
});
