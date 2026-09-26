import { describe, expect, it } from 'vitest';

import {
  countPending,
  enqueue,
  failedEntries,
  markFailed,
  markSynced,
  markSyncing,
  nextPending,
  partitionDrained,
  reviveEntry,
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

describe('countPending', () => {
  const list = [
    entry({ clientId: 'a', entityType: 'photo', op: 'create', status: 'pending' }),
    entry({ clientId: 'b', entityType: 'photo', op: 'create', status: 'synced' }),
    entry({ clientId: 'c', entityType: 'photo', op: 'create', status: 'pending' }),
    entry({ clientId: 'd', entityType: 'task', op: 'update', status: 'pending' }),
    entry({ clientId: 'e', entityType: 'photo', op: 'delete', status: 'pending' }),
    entry({ clientId: 'f', entityType: 'task', op: 'update', status: 'failed' }),
  ];

  it('counts all pending when unfiltered', () => {
    expect(countPending(list)).toBe(4); // a, c, d, e
  });

  it('filters by entityType', () => {
    expect(countPending(list, 'photo')).toBe(3); // a, c, e
  });

  it('filters by entityType AND op (the pending-photo badge value)', () => {
    expect(countPending(list, 'photo', 'create')).toBe(2); // a, c
  });

  it('filters by op alone', () => {
    expect(countPending(list, undefined, 'update')).toBe(1); // d
  });

  it('is zero when nothing matches', () => {
    expect(countPending([], 'photo', 'create')).toBe(0);
  });
});

describe('failedEntries', () => {
  it('returns only failed entries in FIFO order', () => {
    const list = [
      entry({ clientId: 'a', createdAt: 40, status: 'failed' }),
      entry({ clientId: 'b', createdAt: 10, status: 'pending' }),
      entry({ clientId: 'c', createdAt: 20, status: 'failed' }),
      entry({ clientId: 'd', createdAt: 30, status: 'synced' }),
    ];
    expect(failedEntries(list).map((e) => e.clientId)).toEqual(['c', 'a']);
  });

  it('is empty when nothing failed', () => {
    expect(failedEntries([entry({ clientId: 'a', status: 'pending' })])).toEqual([]);
  });
});

describe('partitionDrained', () => {
  it('prunes synced rows and retains pending + failed', () => {
    const list = [
      entry({ clientId: 'a', status: 'synced' }),
      entry({ clientId: 'b', status: 'pending' }),
      entry({ clientId: 'c', status: 'failed' }),
      entry({ clientId: 'd', status: 'synced' }),
    ];
    const { prune, retain } = partitionDrained(list);
    expect(prune.map((e) => e.clientId)).toEqual(['a', 'd']);
    expect(retain.map((e) => e.clientId)).toEqual(['b', 'c']);
  });

  it('handles an empty list', () => {
    expect(partitionDrained([])).toEqual({ prune: [], retain: [] });
  });
});

describe('reviveEntry', () => {
  it('returns a failed entry to pending, resets attempts, clears lastError', () => {
    const list = [entry({ clientId: 'a', status: 'failed', attempts: 7, lastError: 'boom' })];
    const out = reviveEntry(list, 'a');
    expect(out[0]).toMatchObject({ status: 'pending', attempts: 0 });
    expect(out[0]?.lastError).toBeUndefined();
    expect('lastError' in (out[0] as object)).toBe(false); // omitted, not set to undefined
  });

  it('is a no-op for a missing clientId', () => {
    const list = [entry({ clientId: 'a', status: 'failed', attempts: 1 })];
    const out = reviveEntry(list, 'zzz');
    expect(out[0]).toBe(list[0]); // untouched entry keeps its identity
    expect(out[0]).toMatchObject({ status: 'failed', attempts: 1 });
  });

  it('is a no-op for an entry that is not failed', () => {
    const list = [entry({ clientId: 'a', status: 'pending', attempts: 0 })];
    expect(reviveEntry(list, 'a')[0]).toMatchObject({ status: 'pending', attempts: 0 });
  });

  it('does not mutate its input', () => {
    const list = [entry({ clientId: 'a', status: 'failed', attempts: 3, lastError: 'x' })];
    reviveEntry(list, 'a');
    expect(list[0]).toMatchObject({ status: 'failed', attempts: 3, lastError: 'x' });
  });
});
