// Pure outbox operations over an in-memory list. The *store* persists the list;
// these functions never mutate their input and produce a new array each call.
//
// PURE module: no native (Expo / RN / SQLite) imports.

import type { OutboxEntry, OutboxOp } from './types';

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

// --- Hygiene selectors (ORQ-28) ---------------------------------------------
// Read-only queries + immutable transforms used by the runtime to keep the queue
// tidy (drop synced rows, surface a failed dead-letter, revive on manual retry).

/**
 * Count `pending` entries, optionally narrowed by `entityType` and/or `op`.
 * `countPending(list, 'photo', 'create')` = the pending-photo-upload badge value.
 */
export function countPending(
  entries: OutboxEntry[],
  entityType?: string,
  op?: OutboxOp,
): number {
  return entries.filter(
    (e) =>
      e.status === 'pending' &&
      (entityType === undefined || e.entityType === entityType) &&
      (op === undefined || e.op === op),
  ).length;
}

/** The `failed` (dead-letter) entries in FIFO order. */
export function failedEntries(entries: OutboxEntry[]): OutboxEntry[] {
  return sortOutbox(entries).filter((e) => e.status === 'failed');
}

/**
 * Split a just-drained list: `prune` = the `synced` rows (safe to delete from the
 * store), `retain` = everything else (pending kept for retry, failed kept as the
 * dead-letter). Order within each group is preserved (input order).
 */
export function partitionDrained(entries: OutboxEntry[]): {
  prune: OutboxEntry[];
  retain: OutboxEntry[];
} {
  const prune: OutboxEntry[] = [];
  const retain: OutboxEntry[] = [];
  for (const e of entries) {
    if (e.status === 'synced') prune.push(e);
    else retain.push(e);
  }
  return { prune, retain };
}

/**
 * Manual retry: return a `failed` entry to `pending` with `attempts` reset to 0
 * and `lastError` cleared. No-op (input returned unchanged) if the id is absent
 * or the entry is not `failed`.
 */
export function reviveEntry(entries: OutboxEntry[], clientId: string): OutboxEntry[] {
  return entries.map((e) => {
    if (e.clientId !== clientId || e.status !== 'failed') return e;
    // Rebuild WITHOUT lastError (exactOptionalPropertyTypes: omit, never set undefined).
    const revived: OutboxEntry = {
      clientId: e.clientId,
      entityType: e.entityType,
      op: e.op,
      payload: e.payload,
      createdAt: e.createdAt,
      status: 'pending',
      attempts: 0,
    };
    return revived;
  });
}
