// `photo/create` outbox payload + drain handler (D-28 mobile half). PURE module:
// fetch, FormData, the token store and the file system are all injected
// (`PhotoUploadDeps`) — the device wiring lives in `src/photos/upload-deps.ts`.
//
// Flow per entry (offline-first, D-15):
//   1. local file must still exist. If it's gone, first ask the server whether
//      this photo already committed (photos.existsByClientId, capturer-scoped) —
//      TRUE -> success/done (post-crash recovery, ORQ-28 item 4); FALSE ->
//      PERMANENT (bytes genuinely lost); check itself failing -> RETRYABLE.
//   2. multipart POST ${apiUrl}/api/photos { taskId, clientId, file } with the
//      bearer token. clientId = the OUTBOX entry's clientId, so a retried upload
//      overwrites the same object (server is idempotent per clientId).
//      409 + storageKey = "already committed" (an earlier drain's photos.create
//      succeeded but the synced status never persisted) -> reuse that key.
//   3. tRPC photos.create with the SAME clientId + storageKey, capturedAt revived
//      to a Date (JSON-persisted payloads lose Date identity — see send.ts).
//   4. ONLY after the mutation succeeds, delete the local copy (best-effort).
import type { OrqafyApiClient } from '@orqafy/api-client';

import {
  PermanentSendError,
  RetryableSendError,
  classifyHttpStatus,
  classifyTrpcError,
} from './errors';
import type { OutboxEntry } from './types';

export type PhotoMimeType = 'image/jpeg' | 'image/png' | 'image/heic';

/** What the capture screen enqueues. JSON-safe: capturedAt is epoch ms. */
export interface PhotoCreatePayload {
  taskId: string;
  localUri: string;
  mimeType: PhotoMimeType;
  capturedAt: number;
  gpsLat?: number;
  gpsLng?: number;
}

/** React Native's FormData file part (RN Libraries/Network/FormData.js). */
export interface RnFilePart {
  uri: string;
  name: string;
  type: string;
}

/** The subset of FormData the handler uses (RN FormData accepts `RnFilePart`). */
export interface FormDataLike {
  append(name: string, value: string | RnFilePart): void;
}

/** Minimal fetch response surface the handler reads. */
export interface UploadResponse {
  status: number;
  json(): Promise<unknown>;
}

export type UploadFetch = (
  url: string,
  init: { method: 'POST'; headers: Record<string, string>; body: FormDataLike },
) => Promise<UploadResponse>;

export interface PhotoUploadDeps {
  /** Backend base URL, no trailing slash. */
  apiUrl: string;
  /** Current bearer token, or null when signed out. */
  getToken(): Promise<string | null>;
  fetch: UploadFetch;
  createFormData(): FormDataLike;
  fileExists(uri: string): Promise<boolean>;
  deleteFile(uri: string): Promise<void>;
}

const EXT: Record<PhotoMimeType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
};

/** Build the outbox payload. GPS is dropped when absent or out of range. */
export function buildPhotoPayload(input: {
  taskId: string;
  localUri: string;
  capturedAt: Date | number;
  mimeType?: PhotoMimeType;
  gps?: { lat: number; lng: number } | null;
}): PhotoCreatePayload {
  const capturedAt =
    input.capturedAt instanceof Date ? input.capturedAt.getTime() : input.capturedAt;
  const gps = input.gps;
  const gpsValid =
    gps != null &&
    Number.isFinite(gps.lat) &&
    Number.isFinite(gps.lng) &&
    gps.lat >= -90 &&
    gps.lat <= 90 &&
    gps.lng >= -180 &&
    gps.lng <= 180;
  return {
    taskId: input.taskId,
    localUri: input.localUri,
    mimeType: input.mimeType ?? 'image/jpeg',
    capturedAt,
    ...(gpsValid ? { gpsLat: gps.lat, gpsLng: gps.lng } : {}),
  };
}

function isPhotoPayload(p: unknown): p is PhotoCreatePayload {
  if (typeof p !== 'object' || p === null) return false;
  const o = p as Record<string, unknown>;
  return (
    typeof o.taskId === 'string' &&
    typeof o.localUri === 'string' &&
    typeof o.mimeType === 'string' &&
    o.mimeType in EXT &&
    typeof o.capturedAt === 'number'
  );
}

function isThisClientsKey(key: unknown, clientId: string): key is string {
  return typeof key === 'string' && key.startsWith(`photos/${clientId}/`);
}

async function readBody(res: UploadResponse): Promise<Record<string, unknown>> {
  try {
    const body = await res.json();
    return typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Step 2: upload the file; returns the server storageKey. */
async function upload(
  entry: OutboxEntry,
  p: PhotoCreatePayload,
  deps: PhotoUploadDeps,
): Promise<string> {
  const token = await deps.getToken();
  if (token === null) {
    throw new RetryableSendError('Not signed in — photo upload waits for re-login');
  }

  const form = deps.createFormData();
  form.append('taskId', p.taskId);
  form.append('clientId', entry.clientId);
  form.append('file', { uri: p.localUri, name: `photo.${EXT[p.mimeType]}`, type: p.mimeType });

  let res: UploadResponse;
  try {
    // No Content-Type header: RN sets multipart/form-data with its own boundary.
    res = await deps.fetch(`${deps.apiUrl}/api/photos`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
  } catch (err) {
    throw new RetryableSendError(
      `Photo upload network error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const body = await readBody(res);
  if (res.status === 200) {
    if (!isThisClientsKey(body.storageKey, entry.clientId)) {
      throw new PermanentSendError('Photo upload returned an unexpected storageKey');
    }
    return body.storageKey;
  }
  // 409 + this clientId's key: already committed by an earlier drain -> reuse it.
  if (res.status === 409 && isThisClientsKey(body.storageKey, entry.clientId)) {
    return body.storageKey;
  }

  const detail = typeof body.error === 'string' ? `: ${body.error}` : '';
  const message = `Photo upload failed (HTTP ${res.status}${detail})`;
  throw classifyHttpStatus(res.status) === 'retryable'
    ? new RetryableSendError(message)
    : new PermanentSendError(message);
}

/** Drain handler for `photo/create` entries. */
export async function sendPhotoCreate(
  client: OrqafyApiClient,
  entry: OutboxEntry,
  deps: PhotoUploadDeps,
): Promise<void> {
  const p = entry.payload;
  if (!isPhotoPayload(p)) {
    throw new PermanentSendError('Malformed photo/create payload');
  }

  let exists: boolean;
  try {
    exists = await deps.fileExists(p.localUri);
  } catch {
    exists = false;
  }
  if (!exists) {
    // The local bytes are gone, so we can't re-upload. But the photo may ALREADY
    // be committed: a crash after photos.create succeeded + the file was deleted,
    // before this outbox row could be pruned (ORQ-28 item 4). Confirm server-side
    // by clientId (bytes-free, capturer-scoped) before failing permanently.
    let committed: boolean;
    try {
      const res = await client.photos.existsByClientId.query({ clientId: entry.clientId });
      committed = res.exists;
    } catch (err) {
      // The existence check ITSELF failed (offline/transient). Don't permanently
      // fail a photo that may well be committed — retry when we can confirm.
      throw new RetryableSendError(
        `Cannot confirm photo commit for a missing local file: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
    if (committed) {
      // Already on the server — nothing to upload, nothing to delete (file is
      // gone). The entry drains to 'synced' and Pass A prunes it.
      return;
    }
    throw new PermanentSendError(`Local photo is missing: ${p.localUri}`);
  }

  const storageKey = await upload(entry, p, deps);

  try {
    await client.photos.create.mutate({
      clientId: entry.clientId,
      taskId: p.taskId,
      storageKey,
      capturedAt: new Date(p.capturedAt), // revive: server input is z.date()
      ...(p.gpsLat !== undefined ? { gpsLat: p.gpsLat } : {}),
      ...(p.gpsLng !== undefined ? { gpsLng: p.gpsLng } : {}),
    });
  } catch (err) {
    throw classifyTrpcError(err);
  }

  // Committed server-side — the local copy is now redundant. Best-effort only.
  try {
    await deps.deleteFile(p.localUri);
  } catch (err) {
    console.warn('[outbox] photo committed but local file delete failed', err);
  }
}
