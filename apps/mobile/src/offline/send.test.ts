// Chunk 3b/5 — outbox transport seam. Two concerns:
//  1) the throw-on-unmapped default (an unmapped entry throws before the client
//     is ever dereferenced — no native, no real client needed); and
//  2) the chunk-5 mappings each dispatch to the right tRPC procedure with the
//     right args — proven with a spy client (never a network call).
import { describe, expect, it, vi } from 'vitest';

import type { OrqafyApiClient } from '@orqafy/api-client';

import { PermanentSendError, RetryableSendError } from './errors';
import { createOutboxSend } from './send';
import type { OutboxEntry } from './types';

// Stand-in client: never touched, because an unmapped entry throws first.
const stubClient = {} as unknown as OrqafyApiClient;

function makeEntry(overrides: Partial<OutboxEntry> = {}): OutboxEntry {
  return {
    clientId: 'c1',
    entityType: 'task',
    op: 'update',
    payload: { id: 't1' },
    createdAt: 0,
    status: 'pending',
    attempts: 0,
    ...overrides,
  };
}

/** A spy client exposing only the three procedures the mappings dispatch to. */
function makeSpyClient() {
  const move = vi.fn().mockResolvedValue({});
  const markRead = vi.fn().mockResolvedValue({ ok: true });
  const submitRequest = vi.fn().mockResolvedValue({});
  const client = {
    tasks: { move: { mutate: move } },
    notifications: { markRead: { mutate: markRead } },
    leave: { submitRequest: { mutate: submitRequest } },
  } as unknown as OrqafyApiClient;
  return { client, move, markRead, submitRequest };
}

/** First argument of a spy's first call, typed — narrows past noUncheckedIndexedAccess. */
function firstArg<T = unknown>(fn: { mock: { calls: unknown[][] } }): T {
  const call = fn.mock.calls[0];
  if (call === undefined) throw new Error('expected the spy to have been called');
  return call[0] as T;
}

describe('createOutboxSend', () => {
  it('throws a clear error for an unmapped entityType/op', async () => {
    const send = createOutboxSend(stubClient);
    // task/delete is not in the registry — hits the throwing default before the
    // (empty) client is ever dereferenced.
    await expect(send(makeEntry({ op: 'delete' }))).rejects.toThrow(
      'No outbox mapping for task/delete',
    );
  });

  it('names the failing entityType and op in the error', async () => {
    const send = createOutboxSend(stubClient);
    await expect(send(makeEntry({ entityType: 'project', op: 'create' }))).rejects.toThrow(
      'No outbox mapping for project/create',
    );
  });

  describe('task/update mapping', () => {
    it('dispatches tasks.move with the Prisma-native status passed through unchanged', async () => {
      const { client, move } = makeSpyClient();
      const send = createOutboxSend(client);
      await send(
        makeEntry({ payload: { id: 't1', status: 'in_progress', boardColumn: 'col-2' } }),
      );
      expect(move).toHaveBeenCalledTimes(1);
      const arg = firstArg<{ id: string; status: string; boardColumn?: string }>(move);
      expect(arg).toEqual({ id: 't1', status: 'in_progress', boardColumn: 'col-2' });
      // The underscore Prisma-native value is forwarded verbatim (no translation).
      expect(arg.status).toBe('in_progress');
    });

    it('omits boardColumn when the payload has none', async () => {
      const { client, move } = makeSpyClient();
      const send = createOutboxSend(client);
      await send(makeEntry({ payload: { id: 't9', status: 'done' } }));
      const arg = firstArg<Record<string, unknown>>(move);
      expect(arg).toEqual({ id: 't9', status: 'done' });
      expect('boardColumn' in arg).toBe(false);
    });
  });

  describe('notification/update mapping', () => {
    it('dispatches notifications.markRead with just the id', async () => {
      const { client, markRead } = makeSpyClient();
      const send = createOutboxSend(client);
      await send(
        makeEntry({
          entityType: 'notification',
          op: 'update',
          payload: { id: 'n1', extra: 'ignored' },
        }),
      );
      expect(markRead).toHaveBeenCalledTimes(1);
      expect(firstArg(markRead)).toEqual({ id: 'n1' });
    });
  });

  describe('photo/create mapping', () => {
    it('is a RETRYABLE failure (photo kept) when no upload deps were injected', async () => {
      const send = createOutboxSend(stubClient);
      await expect(
        send(makeEntry({ entityType: 'photo', op: 'create', payload: {} })),
      ).rejects.toBeInstanceOf(RetryableSendError);
    });

    it('routes to the photo upload handler with the injected deps', async () => {
      const mutate = vi.fn().mockResolvedValue({});
      const client = { photos: { create: { mutate } } } as unknown as OrqafyApiClient;
      const fetch = vi.fn().mockResolvedValue({
        status: 200,
        json: () => Promise.resolve({ storageKey: 'photos/c1/photo.jpg' }),
      });
      const send = createOutboxSend(client, {
        photo: {
          apiUrl: 'http://h',
          getToken: () => Promise.resolve('t'),
          fetch,
          createFormData: () => ({ append: () => undefined }),
          fileExists: () => Promise.resolve(true),
          deleteFile: () => Promise.resolve(),
        },
      });
      await send(
        makeEntry({
          entityType: 'photo',
          op: 'create',
          payload: { taskId: 'x', localUri: 'file:///p.jpg', mimeType: 'image/jpeg', capturedAt: 1 },
        }),
      );
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(mutate).toHaveBeenCalledTimes(1);
    });
  });

  describe('leave/create mapping', () => {
    it('revives JSON date fields to Date OBJECTS before dispatch', async () => {
      const { client, submitRequest } = makeSpyClient();
      const send = createOutboxSend(client);
      const startIso = '2026-01-02T00:00:00.000Z';
      const endEpoch = Date.UTC(2026, 0, 5); // number, as sqlite/JSON may store it
      await send(
        makeEntry({
          entityType: 'leave',
          op: 'create',
          payload: {
            leaveTypeId: 'lt1',
            startDate: startIso,
            endDate: endEpoch,
            reason: 'Vacation',
          },
        }),
      );
      expect(submitRequest).toHaveBeenCalledTimes(1);
      const arg = firstArg<{ leaveTypeId: string; startDate: Date; endDate: Date; reason?: string }>(
        submitRequest,
      );
      // The whole point: Dates, not the persisted string/number.
      expect(arg.startDate).toBeInstanceOf(Date);
      expect(arg.endDate).toBeInstanceOf(Date);
      expect(arg.startDate.toISOString()).toBe(startIso);
      expect(arg.endDate.getTime()).toBe(endEpoch);
      expect(arg.leaveTypeId).toBe('lt1');
      expect(arg.reason).toBe('Vacation');
    });

    it('omits reason when the payload has none', async () => {
      const { client, submitRequest } = makeSpyClient();
      const send = createOutboxSend(client);
      await send(
        makeEntry({
          entityType: 'leave',
          op: 'create',
          payload: { leaveTypeId: 'lt2', startDate: 0, endDate: 0 },
        }),
      );
      const arg = firstArg<Record<string, unknown>>(submitRequest);
      expect('reason' in arg).toBe(false);
    });
  });

  // ORQ-35 — a TRANSPORT/OFFLINE failure (fetch throwing, no HTTP status) or a
  // retryable HTTP status (401/408/429/5xx) on ANY non-photo op must surface as a
  // RetryableSendError so drainOutbox keeps the entry `pending` for the next drain
  // (bounded by maxAttempts=25); genuine 4xx rejections stay PermanentSendError.
  // Classification lives in the shared createOutboxSend wrapper, so it is
  // op-agnostic — the update (task/update) + create (leave/create) cases below
  // prove every mapped op routes through the same path (delete has no mapping yet;
  // once added it inherits the identical wrapper). The RetryableSendError ->
  // `pending` and PermanentSendError -> `failed` consequences are proven in
  // sync-engine.test.ts (drainOutbox); here we assert the classification itself.
  describe('transport/offline classification (ORQ-35)', () => {
    /** A tRPC-shaped error carrying data.httpStatus (what classifyTrpcError reads). */
    function httpError(status: number): Error {
      const err = new Error(`server said HTTP ${status}`);
      (err as unknown as { data: { httpStatus: number } }).data = { httpStatus: status };
      return err;
    }

    /** A transport/offline failure: fetch rejected, so there is NO HTTP status. */
    function networkError(): Error {
      return new TypeError('Network request failed');
    }

    /** Spy client whose task.move + leave.submitRequest both reject with `err`. */
    function makeRejectingClient(err: unknown) {
      const move = vi.fn().mockRejectedValue(err);
      const submitRequest = vi.fn().mockRejectedValue(err);
      const client = {
        tasks: { move: { mutate: move } },
        leave: { submitRequest: { mutate: submitRequest } },
      } as unknown as OrqafyApiClient;
      return { client, move, submitRequest };
    }

    it('network throw on a task/update (offline edit) is RETRYABLE — entry stays pending', async () => {
      const { client } = makeRejectingClient(networkError());
      const send = createOutboxSend(client);
      await expect(
        send(makeEntry({ op: 'update', payload: { id: 't1', status: 'done' } })),
      ).rejects.toBeInstanceOf(RetryableSendError);
    });

    it('network throw on a leave/create (offline create) is RETRYABLE — entry stays pending', async () => {
      const { client } = makeRejectingClient(networkError());
      const send = createOutboxSend(client);
      await expect(
        send(
          makeEntry({
            entityType: 'leave',
            op: 'create',
            payload: { leaveTypeId: 'lt1', startDate: 0, endDate: 0 },
          }),
        ),
      ).rejects.toBeInstanceOf(RetryableSendError);
    });

    it.each([401, 408, 429, 500, 503])(
      'HTTP %i on a non-photo op is RETRYABLE (stays pending)',
      async (status) => {
        const { client } = makeRejectingClient(httpError(status));
        const send = createOutboxSend(client);
        await expect(
          send(makeEntry({ op: 'update', payload: { id: 't1', status: 'done' } })),
        ).rejects.toBeInstanceOf(RetryableSendError);
      },
    );

    it.each([400, 403, 409, 422])(
      'HTTP %i on a non-photo op is PERMANENT (-> failed, never re-sent)',
      async (status) => {
        const { client } = makeRejectingClient(httpError(status));
        const send = createOutboxSend(client);
        await expect(
          send(makeEntry({ op: 'update', payload: { id: 't1', status: 'done' } })),
        ).rejects.toBeInstanceOf(PermanentSendError);
      },
    );

    it('a successful non-photo send still resolves (drains to synced)', async () => {
      const { client, move } = makeSpyClient();
      const send = createOutboxSend(client);
      await expect(
        send(makeEntry({ op: 'update', payload: { id: 't1', status: 'done' } })),
      ).resolves.toBeUndefined();
      expect(move).toHaveBeenCalledTimes(1);
    });
  });
});
