// Outbox transport seam (chunk 3b, mappings filled chunk 5) — wires the chunk-2
// `drainOutbox` SendFn to the real tRPC client.
//
// `drainOutbox` (sync-engine.ts) calls an injected `SendFn` per pending entry.
// This builds that SendFn from an authed client via a dispatch registry keyed by
// `${entityType}/${op}`. Each mapping translates the JSON-persisted outbox
// payload into the exact tRPC mutation input for its procedure.
//
// PAYLOAD REVIVAL (critical): outbox payloads are JSON-serialised in sqlite, so
// `Date` fields arrive back as strings/numbers. A handler whose server input is
// `z.date()` (e.g. leave/create) MUST revive them with `new Date(...)` here —
// superjson only re-hydrates Dates the client itself serialised, not values we
// stored as JSON. Enum/string fields (e.g. task status) are the Prisma-native
// values the caller supplied and pass straight through, untouched.
//
// Pure module: the api-client import is type-only.
import type { OrqafyApiClient } from '@orqafy/api-client';

import type { OutboxEntry, OutboxOp, SendFn } from './types';

/** Transport for a single entity/op — dispatches to a tRPC mutation. */
type OutboxHandler = (client: OrqafyApiClient, entry: OutboxEntry) => Promise<void>;

/** Registry key: `${entityType}/${op}` (e.g. `task/update`). */
type RegistryKey = `${string}/${OutboxOp}`;

// --- Payload contracts (the shape each screen enqueues into the outbox) -------
// Typed locally (no `any`); `entry.payload` is cast to these before dispatch.

/**
 * `task/update` — a kanban card move. `status` is the PRISMA-NATIVE enum value
 * (`in_progress`, underscore), which is what `tasks.move` expects; passed
 * through unchanged (no hyphenated↔underscore translation happens here).
 */
interface TaskUpdatePayload {
  id: string;
  status: 'todo' | 'in_progress' | 'blocked' | 'done';
  boardColumn?: string;
}

/** `notification/update` — mark one notification read. */
interface NotificationUpdatePayload {
  id: string;
}

/**
 * `leave/create` — a leave request. `startDate`/`endDate` come back from JSON as
 * strings (ISO) or numbers (epoch); revived to `Date` before dispatch because
 * the server input is `z.date()`.
 */
interface LeaveCreatePayload {
  leaveTypeId: string;
  startDate: string | number;
  endDate: string | number;
  reason?: string;
}

/**
 * entityType/op -> tRPC mutation dispatch. Any key not present hits the throwing
 * default in `createOutboxSend` (surfaced as a failed attempt, never a silent
 * drop). Optional fields are OMITTED when absent (exactOptionalPropertyTypes).
 */
const registry: Partial<Record<RegistryKey, OutboxHandler>> = {
  'task/update': async (client, entry) => {
    const p = entry.payload as TaskUpdatePayload;
    await client.tasks.move.mutate({
      id: p.id,
      status: p.status, // Prisma-native value passes through unchanged.
      ...(p.boardColumn !== undefined ? { boardColumn: p.boardColumn } : {}),
    });
  },
  'notification/update': async (client, entry) => {
    const p = entry.payload as NotificationUpdatePayload;
    await client.notifications.markRead.mutate({ id: p.id });
  },
  'leave/create': async (client, entry) => {
    const p = entry.payload as LeaveCreatePayload;
    await client.leave.submitRequest.mutate({
      leaveTypeId: p.leaveTypeId,
      // Revive JSON-persisted dates — server input is z.date().
      startDate: new Date(p.startDate),
      endDate: new Date(p.endDate),
      ...(p.reason !== undefined ? { reason: p.reason } : {}),
    });
  },
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
