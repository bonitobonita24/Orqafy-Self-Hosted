// The FileSyncProvider port (R-3 §11.1, referenced by R8 §3.2).
//
// D-14 keeps Nextcloud; R8 picks approach (a) — supervise the one-shot
// `nextcloudcmd` from the Tauri Rust sidecar (a debounced fs-watch trigger + a
// periodic timer, serialized behind a per-folder lock). Approach (c) — our own
// WebDAV engine — is the documented fallback (D-10a option b). Both sit behind
// THIS port so escalating from (a) to (c) is a driver swap, not an app rewrite.

import { z } from 'zod';

/** Which concrete driver backs the provider. */
export type SyncDriverKind = 'nextcloudcmd' | 'webdav';

/** Conflict handling when local and remote diverge on the same file. */
export type ConflictPolicy = 'keep-both' | 'prefer-remote' | 'prefer-local';

export const syncConfigSchema = z.object({
  /** Which driver to build. */
  driver: z.enum(['nextcloudcmd', 'webdav']).default('nextcloudcmd'),
  /** Remote Nextcloud/WebDAV base URL. */
  remoteUrl: z.string().url(),
  /** Absolute path to the local project folder this provider keeps in sync. */
  localPath: z.string().min(1),
  /** Nextcloud username. */
  user: z.string().min(1),
  /** App password / token (never a real account password). Read from env/vault. */
  appPassword: z.string().min(1),
  /** Remote-change poll interval (R8 §3: ~30–60s is an acceptable v1 default). */
  pollIntervalMs: z.number().int().positive().default(45_000),
  /** Debounce window for the local fs-watch trigger. */
  watchDebounceMs: z.number().int().positive().default(2_000),
  /** Glob patterns excluded from sync. */
  excludes: z.array(z.string()).default([]),
  conflictPolicy: z.enum(['keep-both', 'prefer-remote', 'prefer-local']).default('keep-both'),
});
export type SyncConfig = z.infer<typeof syncConfigSchema>;

/** Lifecycle state of a provider. */
export type SyncState = 'idle' | 'syncing' | 'error' | 'stopped';

/** Outcome of a single synchronization pass. */
export interface SyncResult {
  ok: boolean;
  /** Whether the pass transferred anything. */
  changed: boolean;
  /** Process exit code (nextcloudcmd) or a synthetic code (webdav). */
  exitCode: number;
  startedAt: number;
  finishedAt: number;
  error?: string;
}

/** Point-in-time status snapshot. */
export interface SyncStatus {
  driver: SyncDriverKind;
  state: SyncState;
  lastResult?: SyncResult;
  /** True while the supervising loop (timer + watch) is running. */
  supervising: boolean;
}

/**
 * The port every consumer depends on. `syncOnce` is a single pass; `start`/
 * `stop` manage the continuous supervising loop; `getStatus` reports state.
 */
export interface FileSyncProvider {
  readonly kind: SyncDriverKind;

  /** Run exactly one synchronization pass and resolve its result. */
  syncOnce(): Promise<SyncResult>;
  /** Begin continuous sync (debounced fs-watch trigger + periodic timer). */
  start(): Promise<void>;
  /** Stop the supervising loop; in-flight pass is allowed to finish. */
  stop(): Promise<void>;
  /** Current status snapshot. */
  getStatus(): SyncStatus;
}
