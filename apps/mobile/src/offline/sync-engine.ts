// Pure, deterministic outbox drain. Sends pending entries in FIFO order through
// the injected `send` transport, setting each result to `synced` (resolve) or
// `failed` + attempts++ (reject). No timers: retry/backoff is the caller
// re-invoking later (chunk 3 wires the real tRPC `send`).
//
// PURE module: no native (Expo / RN / SQLite) imports.

import type { OutboxEntry, SendFn } from './types';
import { sortOutbox } from './outbox';

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
  opts?: { maxBatch?: number },
): Promise<OutboxEntry[]> {
  const pending = sortOutbox(entries).filter((e) => e.status === 'pending');
  const batch =
    typeof opts?.maxBatch === 'number' ? pending.slice(0, opts.maxBatch) : pending;

  const updated = new Map<string, OutboxEntry>();
  for (const entry of batch) {
    try {
      await send(entry);
      updated.set(entry.clientId, { ...entry, status: 'synced' });
    } catch (err) {
      updated.set(entry.clientId, {
        ...entry,
        status: 'failed',
        attempts: entry.attempts + 1,
        lastError: errorMessage(err),
      });
    }
  }

  return entries.map((e) => updated.get(e.clientId) ?? e);
}
