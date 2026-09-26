// Reactive outbox-status hook (ORQ-28) — subscribes a screen to the runtime's
// status mirror so a pending-photo badge / failed-upload banner re-render as the
// queue drains, retries, or discards. Thin: all state lives in the runtime; this
// is the React binding + the retry/discard actions bound to the screen's client.
//
// PURE-ish glue: imports `react` and the runtime only — no native modules, so it
// stays out of the `src/offline/*.ts` native-import guard.
import { useEffect, useSyncExternalStore } from 'react';

import type { OrqafyApiClient } from '@orqafy/api-client';

import { getOutboxRuntime, type OutboxStatusSnapshot } from './runtime';

/** What a badge/banner consumes: live counts + the two dead-letter actions. */
export interface OutboxStatus extends OutboxStatusSnapshot {
  /** Revive every failed entry and re-drain (the "Retry" action). */
  retryAllFailed: () => Promise<void>;
  /** Discard every failed entry + its local file (the "Dismiss" action). */
  discardAllFailed: () => Promise<void>;
}

/**
 * Subscribe to the outbox status mirror. Re-renders on every drain/enqueue/retry/
 * discard. Seeds the mirror from the store once on mount so counts are correct
 * before the first drain completes.
 */
export function useOutboxStatus(client: OrqafyApiClient): OutboxStatus {
  const runtime = getOutboxRuntime();
  const snapshot = useSyncExternalStore(
    (listener) => runtime.subscribe(listener),
    () => runtime.getStatus(),
    () => runtime.getStatus(),
  );

  useEffect(() => {
    void runtime.refreshStatus();
  }, [runtime]);

  return {
    pendingPhotoCount: snapshot.pendingPhotoCount,
    failedCount: snapshot.failedCount,
    retryAllFailed: () => runtime.retryAllFailed(client),
    discardAllFailed: () => runtime.discardAllFailed(client),
  };
}
