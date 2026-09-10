import { describe, expect, it, vi } from 'vitest';

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
