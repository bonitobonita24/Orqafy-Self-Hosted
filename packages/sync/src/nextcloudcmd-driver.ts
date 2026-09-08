// Approach (a): supervise the one-shot `nextcloudcmd` (R8 recommendation).
//
// STUB: the argv builder is real (and unit-friendly); the actual spawn +
// supervising loop (debounced fs-watch, periodic timer, per-folder lock,
// capped back-off, exit-code parsing) is Part 7 / the Tauri Rust sidecar.
// Signatures + wiring are complete so the app can depend on the port today.

import type {
  FileSyncProvider,
  SyncConfig,
  SyncDriverKind,
  SyncResult,
  SyncStatus,
  SyncState,
} from './provider';

/**
 * Build the argv for a single `nextcloudcmd` run. `nextcloudcmd` is one-shot
 * (R8 §1) — no daemon/interval flag exists — so continuous sync is the
 * supervisor's job, not a flag here. Credentials come from the environment
 * (`--non-interactive` reads `NC_USER` / `NC_PASSWORD`) so they never land in
 * argv / the process table.
 */
export function buildNextcloudCmdArgs(config: SyncConfig): string[] {
  const args = ['--non-interactive', '--path', '/'];
  for (const pattern of config.excludes) {
    args.push('--exclude', pattern);
  }
  args.push(config.localPath, config.remoteUrl);
  return args;
}

/** Env a spawned `nextcloudcmd` reads its credentials from (R8 §1). */
export function nextcloudCmdEnv(config: SyncConfig): Record<string, string> {
  return { NC_USER: config.user, NC_PASSWORD: config.appPassword };
}

export class NextcloudCmdDriver implements FileSyncProvider {
  readonly kind: SyncDriverKind = 'nextcloudcmd';

  private state: SyncState = 'idle';
  private supervising = false;
  private lastResult: SyncResult | undefined;

  constructor(
    private readonly config: SyncConfig,
    /** Path to the bundled binary; the sidecar injects the real one. */
    private readonly binaryPath: string = 'nextcloudcmd',
  ) {}

  syncOnce(): Promise<SyncResult> {
    const startedAt = Date.now();
    this.state = 'syncing';
    // TODO(part-7): spawn `${this.binaryPath} ${args}` with the env below,
    // serialized behind a per-folder lock; parse the exit code; apply capped
    // back-off on failure.
    const args = buildNextcloudCmdArgs(this.config);
    void args;
    void nextcloudCmdEnv(this.config);
    void this.binaryPath;
    const result: SyncResult = {
      ok: false,
      changed: false,
      exitCode: -1,
      startedAt,
      finishedAt: Date.now(),
      error: 'not-implemented: nextcloudcmd spawn lands in Part 7 (Tauri sidecar)',
    };
    this.state = 'idle';
    this.lastResult = result;
    return Promise.resolve(result);
  }

  start(): Promise<void> {
    // TODO(part-7): arm a debounced fs-watch on `localPath` + a periodic timer
    // at `pollIntervalMs`; each fire calls `syncOnce()` behind the lock.
    this.supervising = true;
    return Promise.resolve();
  }

  stop(): Promise<void> {
    // TODO(part-7): clear the timer + watcher; let an in-flight pass finish.
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
