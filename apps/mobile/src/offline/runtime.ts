// Outbox RUNTIME (chunk 5) — the thin app-facing wiring that connects the pure
// outbox/sync-engine logic to the real device: sqlite persistence, UUID minting,
// and a foreground-drain lifecycle. Screens talk to THIS, never to the pure
// primitives directly.
//
// NATIVE IS LAZY (deliberate): `expo-sqlite` (via `./sqlite`) and `react-native`
// (`AppState`) are pulled with dynamic `import()` INSIDE the functions/effects
// that need them — never at module top level. This keeps the pure `./offline`
// barrel (which re-exports this file) importable under vitest / in pure
// consumers WITHOUT resolving native modules, preserving the guarantee documented
// in `./index.ts`. Every native touch is wrapped so a failure LOGS (console.warn)
// rather than throwing — an unavailable store degrades to "nothing queued/drained"
// instead of crashing a screen.
//
// UUIDs come from the pure `./uuid` (crypto.randomUUID, else RFC-4122 v4
// fallback) — the clientId doubles as the server idempotency key and, for
// photo/create, the upload's `clientId` (must be a UUID).
//
// Photo upload deps (D-28) — fetch/FormData/token/file-system — are also
// loaded lazily inside `drain` (`../photos/upload-deps`) for the same reason.
import { useEffect } from 'react';

import type { OrqafyApiClient } from '@orqafy/api-client';

import { enqueue as pureEnqueue } from './outbox';
import { createOutboxSend, type OutboxSendDeps } from './send';
import { drainOutbox } from './sync-engine';
import type { OutboxEntry, OutboxOp, OutboxStore } from './types';
import { newUuid } from './uuid';

/** The app-facing outbox surface a screen consumes. */
export interface OutboxRuntime {
  /**
   * Queue a local mutation. Generates a fresh `clientId`, appends via the pure
   * outbox `enqueue` (idempotent), and persists to the device store. Returns the
   * `clientId`. Never throws — a store failure is logged and the id still returns
   * so the caller's optimistic UI is unaffected (the mutation is simply not
   * durably queued; the next successful enqueue/drain proceeds).
   */
  enqueue(entityType: string, op: OutboxOp, payload: unknown): Promise<string>;
  /**
   * Send all pending entries through the tRPC `client`, persisting each result
   * (synced / failed+attempts). Never throws — transport/store failures are
   * logged; failed entries stay queued for the next drain.
   */
  drain(client: OrqafyApiClient): Promise<void>;
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

/** Device upload seams for photo/create. Missing -> photo entries fail permanently. */
async function getSendDeps(): Promise<OutboxSendDeps> {
  try {
    const { createPhotoUploadDeps } = await import('../photos/upload-deps');
    return { photo: createPhotoUploadDeps() };
  } catch (err) {
    console.warn('[outbox] photo upload deps unavailable', err);
    return {};
  }
}

// --- singleton runtime -------------------------------------------------------

let runtime: OutboxRuntime | null = null;
let inFlightDrain: Promise<void> | null = null;

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
            // Route through the pure enqueue so idempotency/ordering intent is the
            // single source of truth; persist only when it was actually added.
            if (pureEnqueue(existing, entry).length > existing.length) {
              await store.put(entry);
            }
          }
        } catch (err) {
          console.warn('[outbox] enqueue failed to persist', err);
        }
        return entry.clientId;
      },
      drain(client): Promise<void> {
        // Single-flight: overlapping callers (mount, foreground, post-capture)
        // share one drain so the same entry is never sent twice concurrently.
        if (inFlightDrain !== null) return inFlightDrain;
        inFlightDrain = (async (): Promise<void> => {
          try {
            const store = await getStore();
            if (store === null) return;
            const send = createOutboxSend(client, await getSendDeps());
            const entries = await store.list();
            const drained = await drainOutbox(entries, send);
            await store.putMany(drained);
          } catch (err) {
            console.warn('[outbox] drain failed', err);
          } finally {
            inFlightDrain = null;
          }
        })();
        return inFlightDrain;
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
