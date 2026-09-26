// D-28 mobile half — `photo/create` outbox payload + drain handler. Pure: fetch,
// the tRPC client, FormData and the file system are all injected spies.
import { describe, expect, it, vi } from 'vitest';

import type { OrqafyApiClient } from '@orqafy/api-client';

import { PermanentSendError, RetryableSendError } from './errors';
import {
  buildPhotoPayload,
  sendPhotoCreate,
  type FormDataLike,
  type PhotoUploadDeps,
  type RnFilePart,
} from './photo';
import type { OutboxEntry } from './types';

const CLIENT_ID = '3f2b8c1e-9d4a-4b7e-8f21-6a5c0d9e1b23';
const LOCAL_URI = 'file:///data/user/0/app/files/photos/aa11.jpg';
const CAPTURED_AT = Date.UTC(2026, 8, 26, 3, 15, 0);

function makeEntry(payload: unknown = buildPhotoPayload({
  taskId: 'task-1',
  localUri: LOCAL_URI,
  capturedAt: CAPTURED_AT,
  gps: { lat: 13.41, lng: 121.18 },
})): OutboxEntry {
  return {
    clientId: CLIENT_ID,
    entityType: 'photo',
    op: 'create',
    payload: JSON.parse(JSON.stringify(payload)) as unknown, // as sqlite round-trips it
    createdAt: 0,
    status: 'pending',
    attempts: 0,
  };
}

interface Harness {
  deps: PhotoUploadDeps;
  client: OrqafyApiClient;
  fetch: ReturnType<typeof vi.fn>;
  mutate: ReturnType<typeof vi.fn>;
  existsQuery: ReturnType<typeof vi.fn>;
  deleteFile: ReturnType<typeof vi.fn>;
  parts: Array<[string, string | RnFilePart]>;
  order: string[];
}

function harness(opts: {
  status?: number;
  body?: unknown;
  fetchRejects?: Error;
  mutateRejects?: Error;
  fileExists?: boolean;
  token?: string | null;
  deleteThrows?: boolean;
  /** photos.existsByClientId result (missing-file recovery). Default: not committed. */
  existsByClientId?: boolean;
  /** When set, the existence query itself rejects (transient/offline). */
  existsByClientIdRejects?: Error;
} = {}): Harness {
  const order: string[] = [];
  const parts: Array<[string, string | RnFilePart]> = [];
  const fetch = vi.fn(() => {
    order.push('upload');
    if (opts.fetchRejects !== undefined) return Promise.reject(opts.fetchRejects);
    const status = opts.status ?? 200;
    return Promise.resolve({
      status,
      json: () =>
        Promise.resolve(
          opts.body ??
            (status === 200 ? { storageKey: `photos/${CLIENT_ID}/photo.jpg` } : { error: 'x' }),
        ),
    });
  });
  const mutate = vi.fn(() => {
    order.push('mutate');
    if (opts.mutateRejects !== undefined) return Promise.reject(opts.mutateRejects);
    return Promise.resolve({ id: 'photo-row' });
  });
  const existsQuery = vi.fn(() => {
    order.push('exists');
    if (opts.existsByClientIdRejects !== undefined) return Promise.reject(opts.existsByClientIdRejects);
    return Promise.resolve({ exists: opts.existsByClientId ?? false });
  });
  const deleteFile = vi.fn(() => {
    order.push('delete');
    if (opts.deleteThrows === true) return Promise.reject(new Error('EACCES'));
    return Promise.resolve();
  });
  const createFormData = (): FormDataLike => ({
    append: (name, value) => {
      parts.push([name, value]);
    },
  });
  const deps: PhotoUploadDeps = {
    apiUrl: 'http://192.168.1.10:56483',
    getToken: () => Promise.resolve(opts.token === undefined ? 'tok-123' : opts.token),
    fetch,
    createFormData,
    fileExists: () => Promise.resolve(opts.fileExists ?? true),
    deleteFile,
  };
  const client = {
    photos: { create: { mutate }, existsByClientId: { query: existsQuery } },
  } as unknown as OrqafyApiClient;
  return { deps, client, fetch, mutate, existsQuery, deleteFile, parts, order };
}

describe('buildPhotoPayload', () => {
  it('stores capturedAt as an epoch NUMBER and carries no base64', () => {
    const p = buildPhotoPayload({
      taskId: 't1',
      localUri: LOCAL_URI,
      capturedAt: new Date(CAPTURED_AT),
      gps: { lat: 1.5, lng: 2.5 },
    });
    expect(p).toEqual({
      taskId: 't1',
      localUri: LOCAL_URI,
      mimeType: 'image/jpeg',
      capturedAt: CAPTURED_AT,
      gpsLat: 1.5,
      gpsLng: 2.5,
    });
    expect(typeof p.capturedAt).toBe('number');
    expect(JSON.stringify(p)).not.toMatch(/base64/i);
  });

  it('omits gps keys entirely when no fix was obtained', () => {
    const p = buildPhotoPayload({ taskId: 't1', localUri: LOCAL_URI, capturedAt: 5, gps: null });
    expect('gpsLat' in p).toBe(false);
    expect('gpsLng' in p).toBe(false);
  });

  it('drops out-of-range coordinates rather than failing server validation', () => {
    const p = buildPhotoPayload({
      taskId: 't1',
      localUri: LOCAL_URI,
      capturedAt: 5,
      gps: { lat: 91, lng: 10 },
    });
    expect('gpsLat' in p).toBe(false);
  });
});

describe('sendPhotoCreate — happy path', () => {
  it('uploads then mutates then deletes, in that order', async () => {
    const h = harness();
    await sendPhotoCreate(h.client, makeEntry(), h.deps);
    expect(h.order).toEqual(['upload', 'mutate', 'delete']);
  });

  it('POSTs multipart to /api/photos with the bearer token and outbox clientId', async () => {
    const h = harness();
    await sendPhotoCreate(h.client, makeEntry(), h.deps);
    const [url, init] = h.fetch.mock.calls[0] as [string, { method: string; headers: Record<string, string> }];
    expect(url).toBe('http://192.168.1.10:56483/api/photos');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer tok-123');
    // RN must set the multipart boundary itself — never a hand-set Content-Type.
    expect(Object.keys(init.headers).map((k) => k.toLowerCase())).not.toContain('content-type');
    expect(h.parts).toEqual([
      ['taskId', 'task-1'],
      ['clientId', CLIENT_ID],
      ['file', { uri: LOCAL_URI, name: 'photo.jpg', type: 'image/jpeg' }],
    ]);
  });

  it('mutates photos.create with the same clientId, server storageKey, revived Date + gps', async () => {
    const h = harness();
    await sendPhotoCreate(h.client, makeEntry(), h.deps);
    const arg = h.mutate.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(arg).toEqual({
      clientId: CLIENT_ID,
      taskId: 'task-1',
      storageKey: `photos/${CLIENT_ID}/photo.jpg`,
      capturedAt: new Date(CAPTURED_AT),
      gpsLat: 13.41,
      gpsLng: 121.18,
    });
    expect(arg.capturedAt).toBeInstanceOf(Date);
  });

  it('omits gps from the mutation when the payload has none', async () => {
    const h = harness();
    await sendPhotoCreate(
      h.client,
      makeEntry(buildPhotoPayload({ taskId: 'task-1', localUri: LOCAL_URI, capturedAt: 1, gps: null })),
      h.deps,
    );
    const arg = h.mutate.mock.calls[0]?.[0] as Record<string, unknown>;
    expect('gpsLat' in arg).toBe(false);
    expect('gpsLng' in arg).toBe(false);
  });

  it('a local delete failure does NOT fail the entry', async () => {
    const h = harness({ deleteThrows: true });
    await expect(sendPhotoCreate(h.client, makeEntry(), h.deps)).resolves.toBeUndefined();
    expect(h.mutate).toHaveBeenCalledTimes(1);
  });
});

describe('sendPhotoCreate — failures', () => {
  it.each([500, 502, 503])('HTTP %i ⇒ retryable, no mutate, file kept', async (status) => {
    const h = harness({ status });
    await expect(sendPhotoCreate(h.client, makeEntry(), h.deps)).rejects.toBeInstanceOf(
      RetryableSendError,
    );
    expect(h.mutate).not.toHaveBeenCalled();
    expect(h.deleteFile).not.toHaveBeenCalled();
  });

  it('HTTP 401 ⇒ retryable (after re-login)', async () => {
    const h = harness({ status: 401 });
    await expect(sendPhotoCreate(h.client, makeEntry(), h.deps)).rejects.toBeInstanceOf(
      RetryableSendError,
    );
  });

  it('no stored token ⇒ retryable, never uploads anonymously', async () => {
    const h = harness({ token: null });
    await expect(sendPhotoCreate(h.client, makeEntry(), h.deps)).rejects.toBeInstanceOf(
      RetryableSendError,
    );
    expect(h.fetch).not.toHaveBeenCalled();
  });

  it('network error ⇒ retryable, file kept', async () => {
    const h = harness({ fetchRejects: new TypeError('Network request failed') });
    await expect(sendPhotoCreate(h.client, makeEntry(), h.deps)).rejects.toBeInstanceOf(
      RetryableSendError,
    );
    expect(h.deleteFile).not.toHaveBeenCalled();
  });

  it.each([400, 403, 413, 415])('HTTP %i ⇒ permanent, file kept', async (status) => {
    const h = harness({ status, body: { error: 'server says no' } });
    const err = await sendPhotoCreate(h.client, makeEntry(), h.deps).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PermanentSendError);
    expect((err as Error).message).toContain(String(status));
    expect((err as Error).message).toContain('server says no');
    expect(h.mutate).not.toHaveBeenCalled();
    expect(h.deleteFile).not.toHaveBeenCalled();
  });

  it('HTTP 409 WITH storageKey ⇒ already uploaded: mutate with that key, then delete', async () => {
    const key = `photos/${CLIENT_ID}/photo.jpg`;
    const h = harness({ status: 409, body: { error: 'Photo already committed', storageKey: key } });
    await sendPhotoCreate(h.client, makeEntry(), h.deps);
    expect(h.order).toEqual(['upload', 'mutate', 'delete']);
    const arg = h.mutate.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(arg.storageKey).toBe(key);
    expect(arg.clientId).toBe(CLIENT_ID);
  });

  it('HTTP 409 WITHOUT storageKey ⇒ permanent, no mutate, file kept', async () => {
    const h = harness({ status: 409, body: { error: 'conflict' } });
    await expect(sendPhotoCreate(h.client, makeEntry(), h.deps)).rejects.toBeInstanceOf(
      PermanentSendError,
    );
    expect(h.mutate).not.toHaveBeenCalled();
    expect(h.deleteFile).not.toHaveBeenCalled();
  });

  it('HTTP 409 whose storageKey belongs to another clientId ⇒ permanent', async () => {
    const h = harness({ status: 409, body: { storageKey: 'photos/other/photo.jpg' } });
    await expect(sendPhotoCreate(h.client, makeEntry(), h.deps)).rejects.toBeInstanceOf(
      PermanentSendError,
    );
    expect(h.mutate).not.toHaveBeenCalled();
  });

  it('HTTP 411 (missing Content-Length) ⇒ permanent', async () => {
    const h = harness({ status: 411 });
    await expect(sendPhotoCreate(h.client, makeEntry(), h.deps)).rejects.toBeInstanceOf(
      PermanentSendError,
    );
  });

  it('HTTP 429 (rate limited) ⇒ retryable, file kept', async () => {
    const h = harness({ status: 429 });
    await expect(sendPhotoCreate(h.client, makeEntry(), h.deps)).rejects.toBeInstanceOf(
      RetryableSendError,
    );
    expect(h.deleteFile).not.toHaveBeenCalled();
  });

  it('missing local file, never committed ⇒ permanent, no upload attempted', async () => {
    const h = harness({ fileExists: false, existsByClientId: false });
    await expect(sendPhotoCreate(h.client, makeEntry(), h.deps)).rejects.toBeInstanceOf(
      PermanentSendError,
    );
    expect(h.existsQuery).toHaveBeenCalledWith({ clientId: CLIENT_ID });
    expect(h.fetch).not.toHaveBeenCalled();
  });

  it('missing local file but ALREADY committed server-side ⇒ resolves (post-crash recovery), no upload/mutate/delete', async () => {
    const h = harness({ fileExists: false, existsByClientId: true });
    await expect(sendPhotoCreate(h.client, makeEntry(), h.deps)).resolves.toBeUndefined();
    expect(h.existsQuery).toHaveBeenCalledWith({ clientId: CLIENT_ID });
    expect(h.fetch).not.toHaveBeenCalled();
    expect(h.mutate).not.toHaveBeenCalled();
    expect(h.deleteFile).not.toHaveBeenCalled();
  });

  it('missing local file + existence check itself fails ⇒ retryable (never permanently fail an unconfirmed photo)', async () => {
    const h = harness({ fileExists: false, existsByClientIdRejects: new TypeError('offline') });
    await expect(sendPhotoCreate(h.client, makeEntry(), h.deps)).rejects.toBeInstanceOf(
      RetryableSendError,
    );
    expect(h.fetch).not.toHaveBeenCalled();
    expect(h.mutate).not.toHaveBeenCalled();
  });

  it('a 200 whose storageKey is not this clientId’s key ⇒ permanent, no mutate', async () => {
    const h = harness({ body: { storageKey: 'photos/someone-else/photo.jpg' } });
    await expect(sendPhotoCreate(h.client, makeEntry(), h.deps)).rejects.toBeInstanceOf(
      PermanentSendError,
    );
    expect(h.mutate).not.toHaveBeenCalled();
  });

  it('mutate FORBIDDEN ⇒ permanent and the file is NOT deleted', async () => {
    const forbidden = Object.assign(new Error('Not the assignee'), {
      data: { code: 'FORBIDDEN', httpStatus: 403 },
    });
    const h = harness({ mutateRejects: forbidden });
    await expect(sendPhotoCreate(h.client, makeEntry(), h.deps)).rejects.toBeInstanceOf(
      PermanentSendError,
    );
    expect(h.deleteFile).not.toHaveBeenCalled();
  });

  it('mutate network failure ⇒ retryable and the file is NOT deleted (re-upload is idempotent)', async () => {
    const h = harness({ mutateRejects: new TypeError('Network request failed') });
    await expect(sendPhotoCreate(h.client, makeEntry(), h.deps)).rejects.toBeInstanceOf(
      RetryableSendError,
    );
    expect(h.deleteFile).not.toHaveBeenCalled();
  });

  it('a malformed payload ⇒ permanent', async () => {
    const h = harness();
    await expect(
      sendPhotoCreate(h.client, makeEntry({ taskId: 't' }), h.deps),
    ).rejects.toBeInstanceOf(PermanentSendError);
  });
});
