// Driver-selected provider construction. The one place the app chooses the
// recommended nextcloudcmd supervisor vs the WebDAV fallback (R8).

import { syncConfigSchema, type FileSyncProvider, type SyncConfig } from './provider';
import { NextcloudCmdDriver } from './nextcloudcmd-driver';
import { WebDavSyncDriver } from './webdav-driver';

/** Build the {@link FileSyncProvider} for a validated config. */
export function createFileSyncProvider(config: SyncConfig): FileSyncProvider {
  switch (config.driver) {
    case 'nextcloudcmd':
      return new NextcloudCmdDriver(config);
    case 'webdav':
      return new WebDavSyncDriver(config);
  }
}

/** Parse + validate a raw config (e.g. from env) and build the provider. */
export function createFileSyncProviderFromRaw(raw: unknown): FileSyncProvider {
  return createFileSyncProvider(syncConfigSchema.parse(raw));
}
