// Server-side storage adapter singleton.
//
// The whole upload/download transport is server-proxied (no browser-direct
// presigned URLs), so credentials only ever exist here. Config is derived from
// env: STORAGE_BACKEND=local uses a disk directory; anything else defaults to
// the S3/MinIO path (forcePathStyle=true is required for MinIO). The instance
// is cached on globalThis so Next.js dev HMR never re-instantiates the SDK
// client (same pattern as the @orqafy/db Prisma singleton).
import 'server-only';
import { createStorageAdapterFromRaw, type StorageAdapter } from '@orqafy/storage';

const globalForStorage = globalThis as unknown as { orqafyStorage?: StorageAdapter };

/** Build the raw config object from env (mapping env names → adapter keys). */
function buildRawConfig(): unknown {
  if (process.env.STORAGE_BACKEND === 'local') {
    return {
      provider: 'local',
      baseDir: process.env.STORAGE_LOCAL_DIR,
    };
  }
  // Default: S3-compatible (MinIO / AWS S3 / R2). NOTE the env names
  // S3_ACCESS_KEY / S3_SECRET_KEY differ from the config keys.
  return {
    provider: 's3',
    bucket: process.env.S3_BUCKET,
    region: process.env.S3_REGION ?? 'us-east-1',
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: true,
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  };
}

/** The process-wide storage adapter, built lazily on first use. */
export function getStorageAdapter(): StorageAdapter {
  const existing = globalForStorage.orqafyStorage;
  if (existing !== undefined) return existing;

  const adapter = createStorageAdapterFromRaw(buildRawConfig());
  globalForStorage.orqafyStorage = adapter;
  return adapter;
}
