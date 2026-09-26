import { describe, expect, it, vi } from 'vitest';

import { PermanentSendError, RetryableSendError } from './errors';
import { drainOutbox } from './sync-engine';
import type { OutboxEntry } from './types';

function entry(over: Partial<OutboxEntry> & { clientId: string }): OutboxEntry {
  return {
    entityType: 'task',
    op: 'update',
    payload: {},
    createdAt: 1000,
    status: 'pending',
    attempts: 0,
    ...over,
  };
}

describe('drainOutbox — retryable vs permanent (photo/create, D-28)', () => {
  it('keeps a RetryableSendError entry PENDING (re-drained later), bumping attempts', async () => {
    const send = vi.fn().mockRejectedValue(new RetryableSendError('HTTP 503'));
    const out = await drainOutbox([entry({ clientId: 'a', attempts: 2 })], send);
    expect(out[0]).toMatchObject({ status: 'pending', attempts: 3, lastError: 'HTTP 503' });
  });

  it('marks a PermanentSendError entry FAILED (never retried)', async () => {
    const send = vi.fn().mockRejectedValue(new PermanentSendError('HTTP 415'));
    const out = await drainOutbox([entry({ clientId: 'a' })], send);
    expect(out[0]).toMatchObject({ status: 'failed', attempts: 1, lastError: 'HTTP 415' });
  });

  it('gives up (failed) once a retryable entry reaches maxAttempts', async () => {
    const send = vi.fn().mockRejectedValue(new RetryableSendError('offline'));
    const out = await drainOutbox([entry({ clientId: 'a', attempts: 4 })], send, {
      maxAttempts: 5,
    });
    expect(out[0]).toMatchObject({ status: 'failed', attempts: 5 });
  });

  it('a retried-then-successful entry ends synced', async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(new RetryableSendError('offline'))
      .mockResolvedValueOnce(undefined);
    const first = await drainOutbox([entry({ clientId: 'a' })], send);
    const second = await drainOutbox(first, send);
    expect(second[0]).toMatchObject({ status: 'synced', attempts: 1 });
  });
});

describe('drainOutbox', () => {
  it('marks entries synced when send resolves', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const out = await drainOutbox([entry({ clientId: 'a' }), entry({ clientId: 'b' })], send);
    expect(out.every((e) => e.status === 'synced')).toBe(true);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('marks a failed entry and bumps attempts when send rejects', async () => {
    const send = vi.fn().mockRejectedValue(new Error('offline'));
    const out = await drainOutbox([entry({ clientId: 'a', attempts: 1 })], send);
    expect(out[0]).toMatchObject({ status: 'failed', attempts: 2, lastError: 'offline' });
  });

  it('sends pending entries in FIFO order', async () => {
    const seen: string[] = [];
    const send = vi.fn((e: OutboxEntry) => {
      seen.push(e.clientId);
      return Promise.resolve();
    });
    await drainOutbox(
      [
        entry({ clientId: 'c', createdAt: 30 }),
        entry({ clientId: 'a', createdAt: 10 }),
        entry({ clientId: 'b', createdAt: 20 }),
      ],
      send,
    );
    expect(seen).toEqual(['a', 'b', 'c']);
  });

  it('preserves the original array order in its result', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const out = await drainOutbox(
      [entry({ clientId: 'c', createdAt: 30 }), entry({ clientId: 'a', createdAt: 10 })],
      send,
    );
    expect(out.map((e) => e.clientId)).toEqual(['c', 'a']);
  });

  it('skips non-pending entries and leaves them untouched', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const out = await drainOutbox(
      [entry({ clientId: 'a', status: 'synced' }), entry({ clientId: 'b', status: 'pending' })],
      send,
    );
    expect(send).toHaveBeenCalledTimes(1);
    expect(out.find((e) => e.clientId === 'a')?.status).toBe('synced');
    expect(out.find((e) => e.clientId === 'b')?.status).toBe('synced');
  });

  it('respects maxBatch', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const out = await drainOutbox(
      [
        entry({ clientId: 'a', createdAt: 10 }),
        entry({ clientId: 'b', createdAt: 20 }),
        entry({ clientId: 'c', createdAt: 30 }),
      ],
      send,
      { maxBatch: 2 },
    );
    expect(send).toHaveBeenCalledTimes(2);
    expect(out.find((e) => e.clientId === 'c')?.status).toBe('pending'); // beyond the batch
  });

  it('does not mutate the input entries', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const input = [entry({ clientId: 'a' })];
    await drainOutbox(input, send);
    expect(input[0]?.status).toBe('pending');
  });
});
