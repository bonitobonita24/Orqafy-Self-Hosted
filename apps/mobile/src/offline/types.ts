// Offline-first data layer — shared types (chunk 2, DESIGN §8 / D-15).
//
// PURE module: no native (Expo / RN / SQLite) imports. Runs under vitest in Node.
// The SQLite adapter (./sqlite) implements the *Store interfaces over the device
// DB; these types are the seam between the pure merge/queue logic and whatever
// persistence backs it.

/** Lifecycle of a queued local mutation. */
export type OutboxStatus = 'pending' | 'syncing' | 'synced' | 'failed';

/** The kind of mutation a queue entry represents. */
export type OutboxOp = 'create' | 'update' | 'delete';

/**
 * A durable, append-only local mutation awaiting sync.
 * `clientId` is a stable caller-supplied UUID — the idempotency key the server
 * dedupes on (BullMQ-side). Entries sort by `createdAt` asc (FIFO), `clientId`
 * as a stable tiebreak.
 */
export interface OutboxEntry {
  clientId: string;
  entityType: string;
  op: OutboxOp;
  payload: unknown;
  /** Epoch milliseconds. */
  createdAt: number;
  status: OutboxStatus;
  attempts: number;
  lastError?: string;
}

/** A local delete marker. Suppresses server resurrection until cleared. */
export interface Tombstone {
  entityType: string;
  id: string;
  /** Epoch milliseconds. */
  deletedAt: number;
}

/**
 * The minimal shape the merge engine needs from any cached entity. Real domain
 * records (`@orqafy/shared`) carry richer fields and a `Date` `updatedAt`; over
 * the cache/wire that value arrives as an ISO string or epoch number, so we
 * generalise over `string | number` and compare via `new Date(...).getTime()`.
 */
export interface SyncableRecord {
  id: string;
  updatedAt: string | number;
}

/** Outcome of reconciling a server snapshot against the local cache. */
export interface ReconcileResult<T> {
  /** The records to persist as the new cache for this entity type. */
  merged: T[];
  /** Ids kept as server (LWW) that also had a local pending/failed edit. */
  conflicts: string[];
  /** Ids removed because the server deleted them (fullSync only). */
  removed: string[];
}

/** Injected transport seam — chunk 3 wires the real tRPC client here. */
export type SendFn = (entry: OutboxEntry) => Promise<void>;

/** Persistent cache of server records, keyed by (entityType, id). */
export interface CacheStore<T extends SyncableRecord = SyncableRecord> {
  get(entityType: string, id: string): Promise<T | null>;
  list(entityType: string): Promise<T[]>;
  put(entityType: string, record: T): Promise<void>;
  putMany(entityType: string, records: T[]): Promise<void>;
  delete(entityType: string, id: string): Promise<void>;
  clear(entityType: string): Promise<void>;
}

/** Durable, ordered queue of local mutations. */
export interface OutboxStore {
  list(): Promise<OutboxEntry[]>;
  put(entry: OutboxEntry): Promise<void>;
  putMany(entries: OutboxEntry[]): Promise<void>;
  delete(clientId: string): Promise<void>;
  clear(): Promise<void>;
}

/** Local delete markers. */
export interface TombstoneStore {
  list(entityType?: string): Promise<Tombstone[]>;
  put(tombstone: Tombstone): Promise<void>;
  delete(entityType: string, id: string): Promise<void>;
  clear(): Promise<void>;
}
