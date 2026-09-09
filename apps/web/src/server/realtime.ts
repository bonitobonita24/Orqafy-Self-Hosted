// Realtime seam (D-22). Web is real-time: the kanban board and the notification
// center update live. This module is the typed pub/sub bus + tRPC observable
// factory that the routers publish to and subscribe from.
//
// TRANSPORT (D-22, wired): subscriptions ride tRPC v11 SSE over the existing
// Next.js fetch route handler (`app/api/trpc/[trpc]/route.ts`, force-dynamic) via
// the client `httpSubscriptionLink` (splitLink in providers.tsx). No standalone
// WS server / custom Next server is needed for the single-process self-hosted
// deployment (D-3). Cookies flow same-origin, so Auth.js session auth is carried
// automatically. Mobile stays offline-first / sync-on-reconnect (never a WS/SSE
// dependency). SCALE SEAM: the bus is in-memory / single-process — a multi-
// instance deployment must back it with Valkey pub/sub (POST-V1, not wired).
import 'server-only';
import { observable } from '@trpc/server/observable';

/** Live event payloads. Extend as more surfaces go real-time. */
export interface RealtimeEventMap {
  'task:updated': { projectId: string; taskId: string };
  'board:changed': { projectId: string };
  'notification:new': { userId: string; notificationId: string };
}

type EventName = keyof RealtimeEventMap;
type Listener<E extends EventName> = (payload: RealtimeEventMap[E]) => void;

class RealtimeBus {
  private readonly listeners = new Map<EventName, Set<Listener<EventName>>>();

  on<E extends EventName>(event: E, listener: Listener<E>): () => void {
    const set = this.listeners.get(event) ?? new Set<Listener<EventName>>();
    set.add(listener as Listener<EventName>);
    this.listeners.set(event, set);
    return () => {
      set.delete(listener as Listener<EventName>);
    };
  }

  emit<E extends EventName>(event: E, payload: RealtimeEventMap[E]): void {
    const set = this.listeners.get(event);
    if (set === undefined) return;
    for (const listener of set) (listener as Listener<E>)(payload);
  }
}

/** Process-wide singleton (survives dev hot-reload like the Prisma client). */
const globalForBus = globalThis as unknown as { orqafyRealtimeBus?: RealtimeBus };
export const realtimeBus: RealtimeBus = globalForBus.orqafyRealtimeBus ?? new RealtimeBus();
if (process.env.NODE_ENV !== 'production') globalForBus.orqafyRealtimeBus = realtimeBus;

/** Build a tRPC observable that streams one event name to the subscriber. */
export function subscribeTo<E extends EventName>(
  event: E,
  filter?: (payload: RealtimeEventMap[E]) => boolean,
) {
  return observable<RealtimeEventMap[E]>((emit) => {
    const off = realtimeBus.on(event, (payload) => {
      if (filter === undefined || filter(payload)) emit.next(payload);
    });
    return off;
  });
}
