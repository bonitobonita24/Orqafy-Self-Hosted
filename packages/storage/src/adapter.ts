// The storage abstraction — one interface, two deployment-selected backends.
//
// R-2 conclusion (docs/planning/R2_NAS_STORAGE.md §0): the app only ever speaks
// this adapter; NFS-mounted-MinIO vs local-disk is a *deployment* concern, not an
// application one. The same S3 code path also serves the post-v1 Cloudflare R2
// add-on (D-27) — R2 is the same S3 API, so the adapter stays provider-agnostic.
//
//   provider: 's3'    -> MinIO / AWS S3 / Cloudflare R2 (incl. an NFS-mounted
//                        MinIO data dir — that's still the S3 path)
//   provider: 'local' -> a plain local-disk directory fallback (dev / tiny
//                        single-box installs with no object store)

import { z } from 'zod';

/** Bytes + metadata to store under a key. */
export interface PutObjectInput {
  key: string;
  body: Uint8Array | Buffer | string;
  contentType?: string;
  /** Arbitrary user metadata persisted alongside the object where supported. */
  metadata?: Record<string, string>;
}

/** Result of a successful {@link StorageAdapter.putObject}. */
export interface PutObjectResult {
  key: string;
  /** Entity tag / content hash where the backend provides one. */
  etag?: string;
  size: number;
}

/** Bytes + resolved metadata returned by {@link StorageAdapter.getObject}. */
export interface GetObjectResult {
  key: string;
  body: Uint8Array;
  contentType?: string;
  size: number;
}

/** Lightweight listing entry. */
export interface StorageObjectMeta {
  key: string;
  size: number;
  lastModified?: Date;
  etag?: string;
}

/** Options for presigned URL minting. */
export interface PresignOptions {
  /** Seconds until the URL expires (default 900 = 15 min). */
  expiresInSeconds?: number;
  /** Content-type the client must send (upload) or receive (download). */
  contentType?: string;
}

/** A minted presigned URL. */
export interface PresignedUrl {
  url: string;
  method: 'PUT' | 'GET';
  key: string;
  expiresAt: Date;
}

/**
 * The single storage port every consumer depends on. Both the S3 and local-disk
 * backends implement it identically, so swapping is a config change.
 */
export interface StorageAdapter {
  /** Which backend is active — useful for diagnostics and capability checks. */
  readonly provider: StorageProvider;

  putObject(input: PutObjectInput): Promise<PutObjectResult>;
  getObject(key: string): Promise<GetObjectResult>;
  deleteObject(key: string): Promise<void>;
  objectExists(key: string): Promise<boolean>;
  listObjects(prefix?: string): Promise<StorageObjectMeta[]>;

  /** Presigned upload (client PUTs bytes straight to the backend). */
  getPresignedUploadUrl(key: string, options?: PresignOptions): Promise<PresignedUrl>;
  /** Presigned download (client GETs bytes straight from the backend). */
  getPresignedDownloadUrl(key: string, options?: PresignOptions): Promise<PresignedUrl>;
}

export type StorageProvider = 's3' | 'local';

/**
 * S3-compatible backend config. `endpoint` + `forcePathStyle` cover MinIO and
 * R2; omit `endpoint` for real AWS S3. Credentials are read from the config or,
 * when absent, from the ambient AWS credential chain.
 */
export const s3StorageConfigSchema = z.object({
  provider: z.literal('s3'),
  bucket: z.string().min(1),
  region: z.string().min(1).default('us-east-1'),
  /** Custom endpoint for MinIO (`http://minio:9000`) or R2. Omit for AWS S3. */
  endpoint: z.string().url().optional(),
  /** MinIO requires path-style addressing; AWS/R2 use virtual-hosted by default. */
  forcePathStyle: z.boolean().default(false),
  accessKeyId: z.string().min(1).optional(),
  secretAccessKey: z.string().min(1).optional(),
});
export type S3StorageConfig = z.infer<typeof s3StorageConfigSchema>;

/**
 * Local-disk backend config. `baseDir` is the root the keys are written under —
 * in the NAS deployment this can be the mounted NFS path, giving a no-object-
 * store fallback that still lands bytes on the same volume (R-2).
 */
export const localStorageConfigSchema = z.object({
  provider: z.literal('local'),
  baseDir: z.string().min(1),
  /**
   * Base URL an app-side proxy route serves objects from, used to synthesise
   * "presigned" URLs (local disk has no native presigning — see the adapter).
   */
  publicBaseUrl: z.string().url().optional(),
});
export type LocalStorageConfig = z.infer<typeof localStorageConfigSchema>;

export const storageConfigSchema = z.discriminatedUnion('provider', [
  s3StorageConfigSchema,
  localStorageConfigSchema,
]);
export type StorageConfig = z.infer<typeof storageConfigSchema>;

/** Thrown when an object is requested that does not exist. */
export class ObjectNotFoundError extends Error {
  constructor(public readonly key: string) {
    super(`Object not found: ${key}`);
    this.name = 'ObjectNotFoundError';
  }
}
