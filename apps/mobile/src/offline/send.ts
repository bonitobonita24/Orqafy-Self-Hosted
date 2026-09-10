// Outbox transport seam (chunk 3b) — wires the chunk-2 `drainOutbox` SendFn to
// the real tRPC client.
//
// `drainOutbox` (sync-engine.ts) calls an injected `SendFn` per pending entry.
// This builds that SendFn from an authed client via a dispatch registry keyed by
// `${entityType}/${op}`. The concrete per-entity mutation mappings are filled in
// CHUNK 5, when the screens produce real outbox entries and the exact router
// procedures + payload contracts are known — deliberately NOT guessed here.
//
// Until then the registry is empty and any entry hits the throwing default, so
// the seam is real and typed (drainOutbox stays wired) without inventing
// procedures. Pure module: the api-client import is type-only.
import type { OrqafyApiClient } from '@orqafy/api-client';

import type { OutboxEntry, OutboxOp, SendFn } from './types';

/** Transport for a single entity/op — dispatches to a tRPC mutation. */
type OutboxHandler = (client: OrqafyApiClient, entry: OutboxEntry) => Promise<void>;

/** Registry key: `${entityType}/${op}` (e.g. `task/update`). */
type RegistryKey = `${string}/${OutboxOp}`;

/**
 * entityType/op -> tRPC mutation dispatch.
 *
 * chunk 5: fill mappings once screens exist, e.g.
 *   'task/update': (client, entry) =>
 *     client.tasks.update.mutate(entry.payload as TaskUpdateInput),
 * Left empty on purpose — no router procedure is mapped until its exact input
 * contract is known (avoids guessing the surface).
 */
const registry: Partial<Record<RegistryKey, OutboxHandler>> = {
  // chunk 5: fill mappings
};

/**
 * Build the SendFn `drainOutbox` consumes. Unmapped `entityType/op` throws a
 * clear error (surfaced as a failed attempt on the entry, not a silent drop).
 */
export function createOutboxSend(client: OrqafyApiClient): SendFn {
  return async (entry: OutboxEntry): Promise<void> => {
    const key: RegistryKey = `${entry.entityType}/${entry.op}`;
    const handler = registry[key];
    if (handler === undefined) {
      throw new Error(`No outbox mapping for ${entry.entityType}/${entry.op}`);
    }
    await handler(client, entry);
  };
}
