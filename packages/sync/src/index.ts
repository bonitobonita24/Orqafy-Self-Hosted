// @orqafy/sync — the FileSyncProvider port (D-14 / R8). Nextcloud `nextcloudcmd`
// supervisor is the v1 driver (approach a); an own-WebDAV engine is the
// owner-gated fallback seam (approach c / D-10a b). Both are stubs behind the
// port so the app depends on the interface, not the implementation. The real
// spawn + supervising loop lives in Part 7 (the Tauri Rust sidecar).
export * from './provider';
export { NextcloudCmdDriver, buildNextcloudCmdArgs, nextcloudCmdEnv } from './nextcloudcmd-driver';
export { WebDavSyncDriver } from './webdav-driver';
export { createFileSyncProvider, createFileSyncProviderFromRaw } from './factory';
