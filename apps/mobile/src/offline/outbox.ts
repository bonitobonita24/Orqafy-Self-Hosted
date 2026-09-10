// Pure outbox operations over an in-memory list. The *store* persists the list;
// these functions never mutate their input and produce a new array each call.
//
// PURE module: no native (Expo / RN / SQLite) imports.

import type { OutboxEntry } from './types';

/** FIFO order: `createdAt` asc, then `clientId` as a stable tiebreak. */
export function sortOutbox(entries: OutboxEntry[]): OutboxEntry[] {
  return [...entries].sort(
    (a, b) =>
      a.createdAt - b.createdAt ||
      (a.clientId < b.clientId ? -1 : a.clientId > b.clientId ? 1 : 0),
  );
}

/**
 * Append a new entry, idempotent by `clientId`: enqueuing a `clientId` already
 * present is a no-op (never a duplicate). Result stays FIFO-sorted.
 */
export function enqueue(entries: OutboxEntry[], newEntry: OutboxEntry): OutboxEntry[] {
  if (entries.some((e) => e.clientId === newEntry.clientId)) return entries;
  return sortOutbox([...entries, newEntry]);
}

/** The pending entries in FIFO order, optionally capped at `limit`. */
export function nextPending(entries: OutboxEntry[], limit?: number): OutboxEntry[] {
  const pending = sortOutbox(entries).filter((e) => e.status === 'pending');
  return typeof limit === 'number' ? pending.slice(0, limit) : pending;
}

function patch(
  entries: OutboxEntry[],
  clientId: string,
  update: (entry: OutboxEntry) => OutboxEntry,
): OutboxEntry[] {
  return entries.map((e) => (e.clientId === clientId ? update(e) : e));
}

export function markSyncing(entries: OutboxEntry[], clientId: string): OutboxEntry[] {
  return patch(entries, clientId, (e) => ({ ...e, status: 'syncing' }));
}

export function markSynced(entries: OutboxEntry[], clientId: string): OutboxEntry[] {
  return patch(entries, clientId, (e) => ({ ...e, status: 'synced' }));
}

/** Mark failed, bump `attempts`, record `err` (when given). */
export function markFailed(
  entries: OutboxEntry[],
  clientId: string,
  err?: string,
): OutboxEntry[] {
  return patch(entries, clientId, (e) => ({
    ...e,
    status: 'failed',
    attempts: e.attempts + 1,
    ...(err !== undefined ? { lastError: err } : {}),
  }));
}
