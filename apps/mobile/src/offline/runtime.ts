// Outbox RUNTIME (chunk 5, hygiene ORQ-28) — the thin app-facing wiring that
// connects the pure outbox/sync-engine logic to the real device: sqlite
// persistence, UUID minting, a foreground-drain lifecycle, queue HYGIENE (prune
// synced rows, revive/retry/discard failed, sweep orphaned photo files) and a
// reactive status mirror for badges. Screens talk to THIS, never to the pure
// primitives directly.
//
// NATIVE IS LAZY (deliberate): `expo-sqlite` (via `./sqlite`), `react-native`
// (`AppState`), the photo upload deps (`../photos/upload-deps`) and the photo-dir
// listing (`../photos/photo-files`) are all pulled with dynamic `import()` INSIDE
// the functions/effects that need them — never at module top level. This keeps the
// pure `./offline` barrel (which re-exports this file) importable under vitest / in
// pure consumers WITHOUT resolving native modules, preserving the guarantee
// documented in `./index.ts`. Every native touch is wrapped so a failure LOGS
// (console.warn) rather than throwing — an unavailable store degrades to "nothing
// queued/drained" instead of crashing a screen.
//
// UUIDs come from `./uuid-native` (expo-crypto CSPRNG, no weak fallback) — the
// clientId doubles as the server idempotency key and, for photo/create, the
// upload's `clientId`, which F1/D-28 treats as an unguessable capability key.
import { useEffect } from 'react';

import type { OrqafyApiClient } from '@orqafy/api-client';

import {
  countPending,
  failedEntries,
  partitionDrained,
  enqueue as pureEnqueue,
  reviveEntry,
} from './outbox';
import { orphanPhotoFiles } from './reconcile';
import { createOutboxSend, type OutboxSendDeps } from './send';
import { drainOutbox } from './sync-engine';
import type { OutboxEntry, OutboxOp, OutboxStore } from './types';
import { newUuid } from './uuid-native';

/** A photo/create payload's shape the runtime narrows before touching its file. */
interface PhotoPayloadLike {
  localUri: string;
}

/** Reactive counts a status badge/banner reads (see `useOutboxStatus`). */
export interface OutboxStatusSnapshot {
  /** Pending `photo/create` entries — the "waiting to upload" badge value. */
  pendingPhotoCount: number;
  /** Terminal `failed` entries — the dead-letter banner count. */
  failedCount: number;
}

/** The app-facing outbox surface a screen consumes. */
export interface OutboxRuntime {
  /**
   * Queue a local mutation. Generates a fresh `clientId`, appends via the pure
   * outbox `enqueue` (idempotent), and persists to the device store. Returns the
   * `clientId`. Never throws — a store failure is logged and the id still returns
   * so the caller's optimistic UI is unaffected. After persisting it also requests
   * a drain (if a client is known from an earlier drain/mount), which — via the
   * re-drain-if-dirty guard below — closes the single-flight gap where a capture
   * enqueued mid-drain would otherwise wait until the next mount/foreground.
   */
  enqueue(entityType: string, op: OutboxOp, payload: unknown): Promise<string>;
  /**
   * Send all pending entries through the tRPC `client`, persisting each result:
   * `synced` rows are PRUNED (deleted), `failed` rows are retained as the
   * dead-letter, `pending` rows stay for the next drain. Never throws — transport/
   * store failures are logged. Single-flight; a request arriving mid-drain nudges
   * one follow-up pass (bounded). Runs an orphaned-photo-file sweep at the end.
   */
  drain(client: OrqafyApiClient): Promise<void>;
  /** Revive every `failed` entry to `pending` (attempts reset), persist, then drain. */
  retryAllFailed(client: OrqafyApiClient): Promise<void>;
  /** Delete one outbox row + best-effort delete its local photo file. Never throws. */
  discardFailed(clientId: string): Promise<void>;
  /** Discard every `failed` entry (row + local photo file). Never throws. */
  discardAllFailed(client: OrqafyApiClient): Promise<void>;
  /** Refresh the reactive status mirror from the store (no drain). Never throws. */
  refreshStatus(): Promise<void>;
  /** Subscribe to status-mirror changes; returns an unsubscribe fn. */
  subscribe(listener: () => void): () => void;
  /** The current (referentially stable) status snapshot. */
  getStatus(): OutboxStatusSnapshot;
}

// --- sqlite store (lazy, memoised) -------------------------------------------

let storePromise: Promise<OutboxStore | null> | null = null;

/** Open the device outbox store once. Returns null (logged) if native is absent. */
async function getStore(): Promise<OutboxStore | null> {
  if (storePromise === null) {
    storePromise = (async (): Promise<OutboxStore | null> => {
      try {
        const { getDatabase, SqliteOutboxStore } = await import('./sqlite');
        const db = await getDatabase();
        return new SqliteOutboxStore(db);
      } catch (err) {
        console.warn('[outbox] sqlite store unavailable — queue disabled', err);
        return null;
      }
    })();
  }
  return storePromise;
}

// --- non-tRPC send deps (lazy) ------------------------------------------------

/** Device upload seams for photo/create. Missing -> photo entries fail RETRYABLY (send.ts), bounded by drainOutbox maxAttempts (25). */
async function getSendDeps(): Promise<OutboxSendDeps> {
  try {
    const { createPhotoUploadDeps } = await import('../photos/upload-deps');
    return { photo: createPhotoUploadDeps() };
  } catch (err) {
    console.warn('[outbox] photo upload deps unavailable', err);
    return {};
  }
}

// --- reactive status mirror --------------------------------------------------
// An in-memory copy of the queue kept current on every mutation. A cached snapshot
// (recomputed only when its values change) keeps its identity stable so
// `useSyncExternalStore` never loops. Listeners fire on every real change.

let mirror: OutboxEntry[] = [];
let statusSnapshot: OutboxStatusSnapshot = { pendingPhotoCount: 0, failedCount: 0 };
const listeners = new Set<() => void>();

function setMirror(next: OutboxEntry[]): void {
  mirror = next;
  const pendingPhotoCount = countPending(mirror, 'photo', 'create');
  const failedCount = failedEntries(mirror).length;
  if (
    pendingPhotoCount !== statusSnapshot.pendingPhotoCount ||
    failedCount !== statusSnapshot.failedCount
  ) {
    statusSnapshot = { pendingPhotoCount, failedCount };
  }
  for (const listener of listeners) {
    try {
      listener();
    } catch (err) {
      console.warn('[outbox] status listener threw', err);
    }
  }
}

// --- singleton runtime -------------------------------------------------------

let runtime: OutboxRuntime | null = null;
let inFlightDrain: Promise<void> | null = null;
let pendingRedraw = false;
/** The most recent client, so `enqueue` can request an opportunistic drain. */
let lastClient: OrqafyApiClient | null = null;

/** Cap on consecutive re-drains, so a fast enqueue stream can't hot-loop the drain. */
const MAX_CONSECUTIVE_REDRAWS = 3;

/** Narrow an outbox payload to its `localUri` (photo/create). */
function photoLocalUri(entry: OutboxEntry): string | null {
  if (entry.entityType !== 'photo' || entry.op !== 'create') return null;
  const p = entry.payload;
  if (typeof p !== 'object' || p === null) return null;
  const uri = (p as Partial<PhotoPayloadLike>).localUri;
  return typeof uri === 'string' ? uri : null;
}

/** One drain pass: send, prune synced, retain the rest. Returns the retained list. */
async function runDrainOnce(client: OrqafyApiClient): Promise<OutboxEntry[]> {
  const store = await getStore();
  if (store === null) return mirror;
  const send = createOutboxSend(client, await getSendDeps());
  const entries = await store.list();
  const drained = await drainOutbox(entries, send);
  const { prune, retain } = partitionDrained(drained);
  // Persist the survivors, then delete the synced rows (never write synced back).
  await store.putMany(retain);
  for (const e of prune) {
    try {
      await store.delete(e.clientId);
    } catch (err) {
      console.warn('[outbox] prune synced row failed', err);
    }
  }
  setMirror(retain);
  return retain;
}

/** Best-effort sweep of photo files no live entry references (age-guarded). */
async function sweepOrphanPhotos(entries: OutboxEntry[]): Promise<void> {
  try {
    const { listPhotoFiles } = await import('../photos/photo-files');
    const files = listPhotoFiles();
    if (files.length === 0) return;
    const orphans = orphanPhotoFiles({ photoFiles: files, entries, now: Date.now() });
    if (orphans.length === 0) return;
    const deps = await getSendDeps();
    const photo = deps.photo;
    if (photo === undefined) return;
    for (const path of orphans) {
      try {
        await photo.deleteFile(path);
      } catch (err) {
        console.warn('[outbox] orphan photo delete failed', err);
      }
    }
  } catch (err) {
    console.warn('[outbox] orphan photo sweep failed', err);
  }
}

/** Drive one drain (with the re-drain-if-dirty guard + orphan sweep). */
function drainImpl(client: OrqafyApiClient): Promise<void> {
  lastClient = client;
  // Single-flight: a request arriving mid-drain sets pendingRedraw so the current
  // drain runs ONE more pass afterwards — closing the gap where a capture enqueued
  // during an in-flight drain would otherwise not sync until the next mount.
  if (inFlightDrain !== null) {
    pendingRedraw = true;
    return inFlightDrain;
  }
  inFlightDrain = (async (): Promise<void> => {
    try {
      let redraws = 0;
      let finalEntries: OutboxEntry[] = mirror;
      do {
        pendingRedraw = false;
        finalEntries = await runDrainOnce(client);
      } while (pendingRedraw && ++redraws <= MAX_CONSECUTIVE_REDRAWS);
      await sweepOrphanPhotos(finalEntries);
    } catch (err) {
      console.warn('[outbox] drain failed', err);
    } finally {
      inFlightDrain = null;
    }
  })();
  return inFlightDrain;
}

/** The process-wide outbox runtime (created once). */
export function getOutboxRuntime(): OutboxRuntime {
  if (runtime === null) {
    runtime = {
      async enqueue(entityType, op, payload): Promise<string> {
        const entry: OutboxEntry = {
          clientId: newUuid(),
          entityType,
          op,
          payload,
          createdAt: Date.now(),
          status: 'pending',
          attempts: 0,
        };
        try {
          const store = await getStore();
          if (store !== null) {
            const existing = await store.list();
            const next = pureEnqueue(existing, entry);
            // Route through the pure enqueue so idempotency/ordering intent is the
            // single source of truth; persist only when it was actually added.
            if (next.length > existing.length) {
              await store.put(entry);
              setMirror(next);
            }
          }
        } catch (err) {
          console.warn('[outbox] enqueue failed to persist', err);
        }
        // Opportunistic drain (closes the single-flight gap via pendingRedraw when
        // one is already running). No client yet -> the caller's own drain covers it.
        if (lastClient !== null) void drainImpl(lastClient);
        return entry.clientId;
      },
      drain(client): Promise<void> {
        return drainImpl(client);
      },
      async retryAllFailed(client): Promise<void> {
        try {
          const store = await getStore();
          if (store !== null) {
            let entries = await store.list();
            for (const f of failedEntries(entries)) {
              entries = reviveEntry(entries, f.clientId);
            }
            await store.putMany(entries); // INSERT OR REPLACE: revived rows now pending
            setMirror(entries);
          }
        } catch (err) {
          console.warn('[outbox] retryAllFailed failed', err);
        }
        await drainImpl(client);
      },
      async discardFailed(clientId): Promise<void> {
        try {
          const store = await getStore();
          if (store === null) return;
          const entries = await store.list();
          const target = entries.find((e) => e.clientId === clientId);
          // Free the lingering local photo file first (best-effort), then the row.
          const uri = target ? photoLocalUri(target) : null;
          if (uri !== null) {
            try {
              const deps = await getSendDeps();
              await deps.photo?.deleteFile(uri);
            } catch (err) {
              console.warn('[outbox] discard: local photo delete failed', err);
            }
          }
          await store.delete(clientId);
          setMirror(entries.filter((e) => e.clientId !== clientId));
        } catch (err) {
          console.warn('[outbox] discardFailed failed', err);
        }
      },
      async discardAllFailed(): Promise<void> {
        try {
          const store = await getStore();
          if (store === null) return;
          const entries = await store.list();
          for (const f of failedEntries(entries)) {
            await this.discardFailed(f.clientId);
          }
        } catch (err) {
          console.warn('[outbox] discardAllFailed failed', err);
        }
      },
      async refreshStatus(): Promise<void> {
        try {
          const store = await getStore();
          if (store !== null) setMirror(await store.list());
        } catch (err) {
          console.warn('[outbox] refreshStatus failed', err);
        }
      },
      subscribe(listener): () => void {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
      getStatus(): OutboxStatusSnapshot {
        return statusSnapshot;
      },
    };
  }
  return runtime;
}

// --- convenience bindings ----------------------------------------------------

/** Drain the singleton outbox through `client`. Thin wrapper over the runtime. */
export function drain(client: OrqafyApiClient): Promise<void> {
  return getOutboxRuntime().drain(client);
}

// --- React hook --------------------------------------------------------------

/**
 * Wire the outbox to a screen's lifecycle: drains once on mount and again every
 * time the app returns to the FOREGROUND (`AppState` → `active`). Pass the authed
 * tRPC client (from `useAuth().client`). Returns the runtime so the screen can
 * `useOutbox(client).enqueue(...)`.
 *
 * A periodic interval is intentionally NOT used — foreground-return is the drain
 * trigger, which covers the "came back online after being backgrounded" case
 * without a timer (and without an untyped global). Add one here if background
 * retry-while-foregrounded proves necessary.
 */
export function useOutbox(client: OrqafyApiClient): OutboxRuntime {
  useEffect(() => {
    let cancelled = false;
    let sub: { remove: () => void } | undefined;
    void (async () => {
      // Initial drain (e.g. queued while signed out / offline last session).
      await getOutboxRuntime().drain(client);
      try {
        const { AppState } = await import('react-native');
        if (cancelled) return;
        sub = AppState.addEventListener('change', (state) => {
          if (state === 'active') void getOutboxRuntime().drain(client);
        });
      } catch (err) {
        console.warn('[outbox] AppState unavailable — foreground drain disabled', err);
      }
    })();
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [client]);

  return getOutboxRuntime();
}
