// Pure, deterministic outbox drain. Sends pending entries in FIFO order through
// the injected `send` transport, setting each result to `synced` (resolve) or,
// on reject, attempts++ and:
//   - RetryableSendError -> stays `pending` (re-sent next drain) until
//     `maxAttempts` (default DEFAULT_MAX_ATTEMPTS), then `failed`;
//   - anything else (PermanentSendError or an untyped error) -> `failed`.
// `failed` is terminal: only `pending` entries are ever sent. No timers:
// retry/backoff is the caller re-invoking later (mount / foreground drain).
//
// PURE module: no native (Expo / RN / SQLite) imports.

import type { OutboxEntry, SendFn } from './types';
import { RetryableSendError } from './errors';
import { sortOutbox } from './outbox';

/** Retryable failures give up (-> failed) after this many attempts. */
export const DEFAULT_MAX_ATTEMPTS = 25;

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Drain pending entries in FIFO order via `send`. Returns the full entry list in
 * its ORIGINAL order with drained entries' statuses updated; non-pending and
 * beyond-`maxBatch` entries pass through untouched.
 */
export async function drainOutbox(
  entries: OutboxEntry[],
  send: SendFn,
  opts?: { maxBatch?: number; maxAttempts?: number },
): Promise<OutboxEntry[]> {
  const pending = sortOutbox(entries).filter((e) => e.status === 'pending');
  const batch =
    typeof opts?.maxBatch === 'number' ? pending.slice(0, opts.maxBatch) : pending;

  const maxAttempts = opts?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

  const updated = new Map<string, OutboxEntry>();
  for (const entry of batch) {
    try {
      await send(entry);
      updated.set(entry.clientId, { ...entry, status: 'synced' });
    } catch (err) {
      const attempts = entry.attempts + 1;
      const retry = err instanceof RetryableSendError && attempts < maxAttempts;
      updated.set(entry.clientId, {
        ...entry,
        status: retry ? 'pending' : 'failed',
        attempts,
        lastError: errorMessage(err),
      });
    }
  }

  return entries.map((e) => updated.get(e.clientId) ?? e);
}
