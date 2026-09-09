// Build the real JobDeps for the worker process from environment configuration.
// Kept out of main.ts so it stays a thin entrypoint and deps can be smoke-tested.
//
// NOTE: @orqafy/storage does NOT expose an env-driven factory. The env → config
// mapping lives in the web app (apps/web/src/server/storage.ts, buildRawConfig).
// We replicate that exact mapping here (S3/MinIO default, local-disk opt-in) and
// hand the raw object to createStorageAdapterFromRaw, which Zod-validates it.
import { prisma } from '@orqafy/db';
import { createStorageAdapterFromRaw, type StorageAdapter } from '@orqafy/storage';

import { connectionFromEnv } from './connection';
import type { JobDeps } from './deps';
import { createOcrClient } from './ocr';
import { createQueues } from './queues';

/**
 * Map env → the storage adapter, mirroring apps/web/src/server/storage.ts.
 * STORAGE_BACKEND=local selects a disk directory; anything else is the
 * S3-compatible path (forcePathStyle=true for MinIO). The env names
 * S3_ACCESS_KEY / S3_SECRET_KEY intentionally differ from the config keys.
 */
function buildStorageAdapter(env: NodeJS.ProcessEnv): StorageAdapter {
  if (env['STORAGE_BACKEND'] === 'local') {
    return createStorageAdapterFromRaw({
      provider: 'local',
      baseDir: env['STORAGE_LOCAL_DIR'],
    });
  }
  return createStorageAdapterFromRaw({
    provider: 's3',
    bucket: env['S3_BUCKET'],
    region: env['S3_REGION'] ?? 'us-east-1',
    endpoint: env['S3_ENDPOINT'],
    forcePathStyle: true,
    accessKeyId: env['S3_ACCESS_KEY'],
    secretAccessKey: env['S3_SECRET_KEY'],
  });
}

/** Assemble the worker's live dependencies. Throws if OCR_URL is unset. */
export function buildRuntimeDeps(env: NodeJS.ProcessEnv = process.env): JobDeps {
  const ocrUrl = env['OCR_URL'];
  if (ocrUrl === undefined || ocrUrl.length === 0) {
    throw new Error('OCR_URL is required for the jobs worker (points at the OCR sidecar).');
  }
  const connection = connectionFromEnv(env);
  const queues = createQueues(connection);
  return {
    prisma,
    storage: buildStorageAdapter(env),
    ocr: createOcrClient({ baseUrl: ocrUrl }),
    queues: { documentMatching: queues.documentMatching },
  };
}
