// Public offline data-layer API — PURE modules only. The SQLite adapter is
// intentionally NOT re-exported here so pure consumers (and vitest) never pull
// native modules into their graph; import it explicitly via `./offline/sqlite`.
//
// `./runtime` IS re-exported here (the app-facing surface), but it keeps its
// native deps (`./sqlite`, `react-native`) behind dynamic `import()`, so pulling
// this barrel still resolves NO native module — the runtime's native touches
// only load when a screen actually calls enqueue/drain/useOutbox.
//
// NOTE: `enqueue` is NOT re-exported from `./runtime` — the PURE `enqueue`
// (entries, entry) from `./outbox` owns that name. A screen reaches the runtime's
// queue via the singleton/hook: `useOutbox(client).enqueue(entityType, op, payload)`
// or `getOutboxRuntime().enqueue(...)`.

export * from './types';
export * from './outbox';
export * from './reconcile';
export * from './sync-engine';
export * from './errors';
export * from './uuid';
export { buildPhotoPayload, type PhotoCreatePayload, type PhotoMimeType } from './photo';
export { getOutboxRuntime, useOutbox, drain, type OutboxRuntime } from './runtime';
