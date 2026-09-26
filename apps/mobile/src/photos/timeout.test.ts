import { afterEach, describe, expect, it, vi } from 'vitest';

import { resolveWithin } from './timeout';

describe('resolveWithin', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the value when it settles in time', async () => {
    await expect(resolveWithin(Promise.resolve(42), 1000)).resolves.toBe(42);
  });

  it('returns null (never throws) when the promise rejects', async () => {
    await expect(resolveWithin(Promise.reject(new Error('denied')), 1000)).resolves.toBeNull();
  });

  it('returns null once the timeout elapses', async () => {
    vi.useFakeTimers();
    const pending = resolveWithin(new Promise<number>(() => undefined), 5000);
    vi.advanceTimersByTime(5000);
    await expect(pending).resolves.toBeNull();
  });
});
