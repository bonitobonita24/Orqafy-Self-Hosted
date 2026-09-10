// Chunk 3b — outbox transport seam. Verifies the registry's throw-on-unmapped
// default purely (no native, no real client): the empty registry means every
// entry hits the throwing default before the client is ever dereferenced.
import { describe, expect, it } from 'vitest';

import type { OrqafyApiClient } from '@orqafy/api-client';

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

describe('createOutboxSend', () => {
  it('throws a clear error for an unmapped entityType/op', async () => {
    const send = createOutboxSend(stubClient);
    await expect(send(makeEntry())).rejects.toThrow('No outbox mapping for task/update');
  });

  it('names the failing entityType and op in the error', async () => {
    const send = createOutboxSend(stubClient);
    await expect(send(makeEntry({ entityType: 'leave', op: 'create' }))).rejects.toThrow(
      'No outbox mapping for leave/create',
    );
  });
});
