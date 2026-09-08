// Local-disk backend: the no-object-store fallback (dev, or a tiny single-box
// install). Writes keys as files under `baseDir` — which in the NAS deployment
// can be the mounted NFS path, so bytes still land on the same volume (R-2).

import { createHash } from 'node:crypto';
import { access, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';

import {
  ObjectNotFoundError,
  type GetObjectResult,
  type LocalStorageConfig,
  type PresignOptions,
  type PresignedUrl,
  type PutObjectInput,
  type PutObjectResult,
  type StorageAdapter,
  type StorageObjectMeta,
  type StorageProvider,
} from './adapter';

const DEFAULT_EXPIRY_SECONDS = 900;

const byteLength = (body: Uint8Array | Buffer | string): number =>
  typeof body === 'string' ? Buffer.byteLength(body) : body.byteLength;

const isErrno = (err: unknown): err is NodeJS.ErrnoException =>
  err instanceof Error && 'code' in err;

/** {@link StorageAdapter} backed by a local (or NFS-mounted) directory tree. */
export class LocalDiskStorageAdapter implements StorageAdapter {
  readonly provider: StorageProvider = 'local';

  private readonly baseDir: string;

  constructor(private readonly config: LocalStorageConfig) {
    this.baseDir = resolve(config.baseDir);
  }

  /** Map a key to an absolute path, refusing any path-traversal escape. */
  private pathFor(key: string): string {
    const full = resolve(this.baseDir, key);
    const rel = relative(this.baseDir, full);
    if (rel.startsWith('..') || rel.includes(`..${sep}`)) {
      throw new Error(`Refusing key outside base dir: ${key}`);
    }
    return full;
  }

  async putObject(input: PutObjectInput): Promise<PutObjectResult> {
    const path = this.pathFor(input.key);
    await mkdir(dirname(path), { recursive: true });
    const bytes = typeof input.body === 'string' ? Buffer.from(input.body) : input.body;
    await writeFile(path, bytes);
    const etag = createHash('md5').update(bytes).digest('hex');
    return { key: input.key, etag, size: byteLength(input.body) };
  }

  async getObject(key: string): Promise<GetObjectResult> {
    const path = this.pathFor(key);
    try {
      const buffer = await readFile(path);
      // TODO(part-5): infer content-type from the key's extension / a sidecar
      // metadata file. Local disk stores no per-object content-type today.
      return { key, body: new Uint8Array(buffer), size: buffer.byteLength };
    } catch (err) {
      if (isErrno(err) && err.code === 'ENOENT') {
        throw new ObjectNotFoundError(key);
      }
      throw err;
    }
  }

  async deleteObject(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }

  async objectExists(key: string): Promise<boolean> {
    try {
      await access(this.pathFor(key));
      return true;
    } catch {
      return false;
    }
  }

  async listObjects(prefix?: string): Promise<StorageObjectMeta[]> {
    let entries: string[];
    try {
      entries = await readdir(this.baseDir, { recursive: true });
    } catch (err) {
      if (isErrno(err) && err.code === 'ENOENT') {
        return [];
      }
      throw err;
    }

    const results: StorageObjectMeta[] = [];
    for (const entry of entries) {
      const key = entry.split(sep).join('/');
      if (prefix !== undefined && !key.startsWith(prefix)) {
        continue;
      }
      const info = await stat(join(this.baseDir, entry));
      if (!info.isFile()) {
        continue;
      }
      results.push({ key, size: info.size, lastModified: info.mtime });
    }
    return results;
  }

  // Local disk has no native presigning. We synthesise a URL an app-side proxy
  // route serves/accepts (guarded there). TODO(part-5): sign these with a short-
  // lived HMAC token so a raw file path is never a bearer capability.
  private synthUrl(key: string, method: 'PUT' | 'GET', options?: PresignOptions): PresignedUrl {
    const expiresIn = options?.expiresInSeconds ?? DEFAULT_EXPIRY_SECONDS;
    const base = this.config.publicBaseUrl ?? 'file://local';
    const url = `${base.replace(/\/$/, '')}/${encodeURI(key)}`;
    return { url, method, key, expiresAt: new Date(Date.now() + expiresIn * 1000) };
  }

  getPresignedUploadUrl(key: string, options?: PresignOptions): Promise<PresignedUrl> {
    return Promise.resolve(this.synthUrl(key, 'PUT', options));
  }

  getPresignedDownloadUrl(key: string, options?: PresignOptions): Promise<PresignedUrl> {
    return Promise.resolve(this.synthUrl(key, 'GET', options));
  }
}
