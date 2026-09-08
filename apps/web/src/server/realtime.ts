// Realtime seam (D-22). Web is real-time: the kanban board and the notification
// center update live over a websocket. This module is the typed pub/sub bus +
// tRPC observable factory that the routers publish to and subscribe from.
//
// SEAM / TODO(part-7): the websocket *transport* (a standalone Node WS server via
// `@trpc/server/adapters/ws` + `applyWSSHandler`, run alongside the app in the
// Compose bundle) is wired in Part 7. Until then the bus + subscription
// procedures are fully typed and callable in-process; only the socket carrier is
// pending. Mobile stays offline-first / sync-on-reconnect (never a WS dependency).
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
