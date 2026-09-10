import { describe, expect, it } from 'vitest';

import {
  enqueue,
  markFailed,
  markSynced,
  markSyncing,
  nextPending,
  sortOutbox,
} from './outbox';
import type { OutboxEntry } from './types';

function entry(over: Partial<OutboxEntry> & { clientId: string }): OutboxEntry {
  return {
    entityType: 'task',
    op: 'update',
    payload: { title: 'x' },
    createdAt: 1000,
    status: 'pending',
    attempts: 0,
    ...over,
  };
}

describe('sortOutbox', () => {
  it('orders by createdAt asc, then clientId', () => {
    const out = sortOutbox([
      entry({ clientId: 'c', createdAt: 30 }),
      entry({ clientId: 'a', createdAt: 10 }),
      entry({ clientId: 'b', createdAt: 10 }),
    ]);
    expect(out.map((e) => e.clientId)).toEqual(['a', 'b', 'c']);
  });

  it('does not mutate its input', () => {
    const input = [entry({ clientId: 'b', createdAt: 20 }), entry({ clientId: 'a', createdAt: 10 })];
    const snapshot = input.map((e) => e.clientId);
    sortOutbox(input);
    expect(input.map((e) => e.clientId)).toEqual(snapshot);
  });
});

describe('enqueue', () => {
  it('appends and keeps FIFO order', () => {
    let list: OutboxEntry[] = [];
    list = enqueue(list, entry({ clientId: 'a', createdAt: 20 }));
    list = enqueue(list, entry({ clientId: 'b', createdAt: 10 }));
    expect(list.map((e) => e.clientId)).toEqual(['b', 'a']);
  });

  it('is idempotent by clientId — same id twice never duplicates', () => {
    let list = enqueue([], entry({ clientId: 'a', createdAt: 10 }));
    list = enqueue(list, entry({ clientId: 'a', createdAt: 10, payload: { title: 'y' } }));
    expect(list).toHaveLength(1);
    expect(list[0]?.payload).toEqual({ title: 'x' }); // first write wins, no clobber
  });

  it('does not mutate its input', () => {
    const input = [entry({ clientId: 'a', createdAt: 10 })];
    enqueue(input, entry({ clientId: 'b', createdAt: 20 }));
    expect(input).toHaveLength(1);
  });
});

describe('nextPending', () => {
  const list = [
    entry({ clientId: 'a', createdAt: 10, status: 'pending' }),
    entry({ clientId: 'b', createdAt: 20, status: 'synced' }),
    entry({ clientId: 'c', createdAt: 30, status: 'pending' }),
    entry({ clientId: 'd', createdAt: 40, status: 'failed' }),
  ];

  it('returns only pending entries in FIFO order', () => {
    expect(nextPending(list).map((e) => e.clientId)).toEqual(['a', 'c']);
  });

  it('respects the limit', () => {
    expect(nextPending(list, 1).map((e) => e.clientId)).toEqual(['a']);
  });
});

describe('status transitions', () => {
  const list = [entry({ clientId: 'a', createdAt: 10 }), entry({ clientId: 'b', createdAt: 20 })];

  it('markSyncing sets status without touching others', () => {
    const out = markSyncing(list, 'a');
    expect(out[0]?.status).toBe('syncing');
    expect(out[1]?.status).toBe('pending');
    expect(list[0]?.status).toBe('pending'); // immutable
  });

  it('markSynced sets status to synced', () => {
    expect(markSynced(list, 'b')[1]?.status).toBe('synced');
  });

  it('markFailed sets failed, bumps attempts, records the error', () => {
    const out = markFailed(list, 'a', 'network down');
    expect(out[0]).toMatchObject({ status: 'failed', attempts: 1, lastError: 'network down' });
  });

  it('markFailed keeps attempts monotonic across retries', () => {
    let out = markFailed(list, 'a', 'e1');
    out = markFailed(out, 'a', 'e2');
    expect(out[0]).toMatchObject({ attempts: 2, lastError: 'e2' });
  });

  it('markFailed without an error omits lastError', () => {
    const out = markFailed(list, 'a');
    expect(out[0]?.status).toBe('failed');
    expect(out[0]?.lastError).toBeUndefined();
  });
});
