// S3-compatible backend: MinIO (incl. an NFS-mounted data dir), AWS S3, or
// Cloudflare R2 (D-27) — all the same `@aws-sdk/client-s3` code path (R-2).

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import {
  ObjectNotFoundError,
  type GetObjectResult,
  type PresignOptions,
  type PresignedUrl,
  type PutObjectInput,
  type PutObjectResult,
  type S3StorageConfig,
  type StorageAdapter,
  type StorageObjectMeta,
  type StorageProvider,
} from './adapter';

const DEFAULT_EXPIRY_SECONDS = 900;

const byteLength = (body: Uint8Array | Buffer | string): number =>
  typeof body === 'string' ? Buffer.byteLength(body) : body.byteLength;

const isNotFound = (err: unknown): boolean =>
  err instanceof Error && (err.name === 'NotFound' || err.name === 'NoSuchKey');

/** {@link StorageAdapter} backed by any S3-compatible object store. */
export class S3StorageAdapter implements StorageAdapter {
  readonly provider: StorageProvider = 's3';

  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: S3StorageConfig) {
    this.bucket = config.bucket;
    this.client = new S3Client({
      region: config.region,
      forcePathStyle: config.forcePathStyle,
      ...(config.endpoint !== undefined ? { endpoint: config.endpoint } : {}),
      ...(config.accessKeyId !== undefined && config.secretAccessKey !== undefined
        ? {
            credentials: {
              accessKeyId: config.accessKeyId,
              secretAccessKey: config.secretAccessKey,
            },
          }
        : {}),
    });
  }

  async putObject(input: PutObjectInput): Promise<PutObjectResult> {
    const response = await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
        Metadata: input.metadata,
      }),
    );
    return {
      key: input.key,
      size: byteLength(input.body),
      ...(response.ETag !== undefined ? { etag: response.ETag } : {}),
    };
  }

  async getObject(key: string): Promise<GetObjectResult> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      if (response.Body === undefined) {
        throw new ObjectNotFoundError(key);
      }
      const body = await response.Body.transformToByteArray();
      return {
        key,
        body,
        size: response.ContentLength ?? body.byteLength,
        ...(response.ContentType !== undefined ? { contentType: response.ContentType } : {}),
      };
    } catch (err) {
      if (isNotFound(err)) {
        throw new ObjectNotFoundError(key);
      }
      throw err;
    }
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async objectExists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch (err) {
      if (isNotFound(err)) {
        return false;
      }
      throw err;
    }
  }

  async listObjects(prefix?: string): Promise<StorageObjectMeta[]> {
    const response = await this.client.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        ...(prefix !== undefined ? { Prefix: prefix } : {}),
      }),
    );
    const contents = response.Contents ?? [];
    return contents
      .filter((obj): obj is typeof obj & { Key: string } => typeof obj.Key === 'string')
      .map((obj) => ({
        key: obj.Key,
        size: obj.Size ?? 0,
        ...(obj.LastModified !== undefined ? { lastModified: obj.LastModified } : {}),
        ...(obj.ETag !== undefined ? { etag: obj.ETag } : {}),
      }));
  }

  async getPresignedUploadUrl(key: string, options?: PresignOptions): Promise<PresignedUrl> {
    const expiresIn = options?.expiresInSeconds ?? DEFAULT_EXPIRY_SECONDS;
    const url = await getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ...(options?.contentType !== undefined ? { ContentType: options.contentType } : {}),
      }),
      { expiresIn },
    );
    return { url, method: 'PUT', key, expiresAt: new Date(Date.now() + expiresIn * 1000) };
  }

  async getPresignedDownloadUrl(key: string, options?: PresignOptions): Promise<PresignedUrl> {
    const expiresIn = options?.expiresInSeconds ?? DEFAULT_EXPIRY_SECONDS;
    const url = await getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn },
    );
    return { url, method: 'GET', key, expiresAt: new Date(Date.now() + expiresIn * 1000) };
  }
}
