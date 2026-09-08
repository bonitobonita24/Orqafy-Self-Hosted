// Approach (c): our own WebDAV sync engine — the documented FALLBACK only
// (D-10a option b), reached if (a)'s poll-latency or supervision proves
// unworkable AND notify_push can't be wired (R8 §2.3, §3). Kept as a seam so
// the escalation is a driver swap. Fully stubbed — building this is an
// owner-gated, scoped effort (R-3b priced it at 4–7 months), NOT a v1 task.

import type {
  FileSyncProvider,
  SyncConfig,
  SyncDriverKind,
  SyncResult,
  SyncState,
  SyncStatus,
} from './provider';

const notImplemented = (startedAt: number): SyncResult => ({
  ok: false,
  changed: false,
  exitCode: -1,
  startedAt,
  finishedAt: Date.now(),
  error: 'not-implemented: own-WebDAV engine is the owner-gated fallback (D-10a b)',
});

export class WebDavSyncDriver implements FileSyncProvider {
  readonly kind: SyncDriverKind = 'webdav';

  private state: SyncState = 'idle';
  private supervising = false;
  private lastResult: SyncResult | undefined;

  constructor(private readonly config: SyncConfig) {}

  syncOnce(): Promise<SyncResult> {
    // TODO(fallback): PROPFIND diff via getetag / oc:fileid / getlastmodified,
    // plan transfers, resolve conflicts per `config.conflictPolicy`, PUT/GET
    // through the WebDAV substrate (R8 §2.3 citations).
    void this.config.conflictPolicy;
    const result = notImplemented(Date.now());
    this.lastResult = result;
    return Promise.resolve(result);
  }

  start(): Promise<void> {
    this.supervising = true;
    return Promise.resolve();
  }

  stop(): Promise<void> {
    this.supervising = false;
    this.state = 'stopped';
    return Promise.resolve();
  }

  getStatus(): SyncStatus {
    return {
      driver: this.kind,
      state: this.state,
      supervising: this.supervising,
      ...(this.lastResult !== undefined ? { lastResult: this.lastResult } : {}),
    };
  }
}
