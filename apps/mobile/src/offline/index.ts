// Public offline data-layer API — PURE modules only. The SQLite adapter is
// intentionally NOT re-exported here so pure consumers (and vitest) never pull
// native modules into their graph; import it explicitly via `./offline/sqlite`.

export * from './types';
export * from './outbox';
export * from './reconcile';
export * from './sync-engine';
