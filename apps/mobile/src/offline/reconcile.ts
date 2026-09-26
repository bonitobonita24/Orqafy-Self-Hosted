// Pure reconcile: merge a server snapshot into the local cache with
// record-level last-writer-wins, soft-conflict flagging, tombstone suppression,
// and (fullSync) server-delete removal.
//
// PURE module: no native (Expo / RN / SQLite) imports.

import type { OutboxEntry, ReconcileResult, SyncableRecord, Tombstone } from './types';

/** Normalise `updatedAt` (ISO string or epoch number) to comparable epoch ms. */
function toMillis(value: string | number): number {
  return typeof value === 'number' ? value : new Date(value).getTime();
}

/**
 * Reconcile `incoming` server records against the `cached` local records.
 *
 * - LWW: an incoming record wins only when strictly newer than the cached one;
 *   otherwise the local copy is kept (never a silent clobber of newer local).
 * - Soft-conflict: an incoming record that wins AND whose id has a pending/failed
 *   local edit (`pendingIds`) is returned in `conflicts` — the UI shows
 *   "updated on server since you edited" instead of dropping either version.
 * - Tombstones: an incoming record whose id is locally tombstoned is filtered
 *   out (no resurrection) until the tombstone is cleared.
 * - Server delete (fullSync only): a cached id absent from `incoming` is dropped
 *   and reported in `removed`. On a partial sync, unmentioned cached records are
 *   preserved untouched.
 */
export function reconcile<T extends SyncableRecord>(opts: {
  cached: T[];
  incoming: T[];
  tombstones: Tombstone[];
  pendingIds: Set<string>;
  fullSync: boolean;
}): ReconcileResult<T> {
  const { cached, incoming, tombstones, pendingIds, fullSync } = opts;

  const tombstoned = new Set(tombstones.map((t) => t.id));
  const cachedById = new Map(cached.map((c) => [c.id, c]));

  const merged: T[] = [];
  const conflicts: string[] = [];
  const removed: string[] = [];
  const seen = new Set<string>();

  for (const inc of incoming) {
    if (tombstoned.has(inc.id)) continue; // suppress resurrection
    seen.add(inc.id);

    const local = cachedById.get(inc.id);
    if (!local) {
      merged.push(inc);
      continue;
    }

    if (toMillis(inc.updatedAt) > toMillis(local.updatedAt)) {
      merged.push(inc); // server wins (LWW)
      if (pendingIds.has(inc.id)) conflicts.push(inc.id); // soft-conflict
    } else {
      merged.push(local); // local is newer-or-equal — keep it
    }
  }

  for (const local of cached) {
    if (seen.has(local.id) || tombstoned.has(local.id)) continue;
    if (fullSync) {
      removed.push(local.id); // server-side delete
    } else {
      merged.push(local); // partial sync — untouched
    }
  }

  return { merged, conflicts, removed };
}

// --- Orphan-photo-file sweep (ORQ-28) ---------------------------------------
// A captured photo lives at `<documents>/photos/<uuid>.jpg` and is referenced by
// its outbox `photo/create` entry's `payload.localUri`. Once that entry syncs the
// file is deleted (photo.ts); but a discarded/lost entry can leave the file behind.
// This pure diff names the files no live entry references AND that are old enough
// to be safe to delete — the runtime does the actual (native) listing + deletion.

/** Default minimum file age before it is a delete candidate: 1 hour. */
const DEFAULT_ORPHAN_MIN_AGE_MS = 3_600_000;

/** Narrow an outbox `payload` to its `localUri` string, or null. */
function payloadLocalUri(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const uri = (payload as Record<string, unknown>).localUri;
  return typeof uri === 'string' ? uri : null;
}

/**
 * Return the photo-file paths that are orphaned: NOT referenced by any
 * `photo/create` outbox entry's `payload.localUri`, AND older than `minAgeMs`
 * (default 1h) measured as `now - modifiedAt`. The age guard prevents deleting a
 * just-captured file that has not been enqueued yet (a capture→enqueue race).
 */
export function orphanPhotoFiles(input: {
  photoFiles: { path: string; modifiedAt: number }[];
  entries: OutboxEntry[];
  now: number;
  minAgeMs?: number;
}): string[] {
  const { photoFiles, entries, now } = input;
  const minAgeMs = input.minAgeMs ?? DEFAULT_ORPHAN_MIN_AGE_MS;

  const referenced = new Set<string>();
  for (const e of entries) {
    if (e.entityType !== 'photo' || e.op !== 'create') continue;
    const uri = payloadLocalUri(e.payload);
    if (uri !== null) referenced.add(uri);
  }

  return photoFiles
    .filter((f) => !referenced.has(f.path) && now - f.modifiedAt > minAgeMs)
    .map((f) => f.path);
}
