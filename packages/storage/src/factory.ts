// Config-selected adapter construction. The one place the app decides between
// the S3/MinIO/R2 path and the local-disk path (R-2 — a deployment concern).

import { storageConfigSchema, type StorageAdapter, type StorageConfig } from './adapter';
import { LocalDiskStorageAdapter } from './local-disk-adapter';
import { S3StorageAdapter } from './s3-adapter';

/**
 * Build the storage adapter for a (already-validated) config. `provider`
 * discriminates the two backends; both satisfy the same {@link StorageAdapter}.
 */
export function createStorageAdapter(config: StorageConfig): StorageAdapter {
  switch (config.provider) {
    case 's3':
      return new S3StorageAdapter(config);
    case 'local':
      return new LocalDiskStorageAdapter(config);
  }
}

/**
 * Parse + validate a raw config object (e.g. from env) and build the adapter.
 * Throws a Zod error if the shape is wrong.
 */
export function createStorageAdapterFromRaw(raw: unknown): StorageAdapter {
  return createStorageAdapter(storageConfigSchema.parse(raw));
}
