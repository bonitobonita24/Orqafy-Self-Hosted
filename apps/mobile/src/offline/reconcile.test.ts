import { describe, expect, it } from 'vitest';

import { orphanPhotoFiles, reconcile } from './reconcile';
import type { OutboxEntry, SyncableRecord, Tombstone } from './types';

interface Rec extends SyncableRecord {
  title: string;
}

function rec(id: string, updatedAt: string | number, title: string): Rec {
  return { id, updatedAt, title };
}

const NONE = new Set<string>();
const noTombstones: Tombstone[] = [];

describe('reconcile — LWW', () => {
  it('keeps the server record when it is strictly newer', () => {
    const r = reconcile<Rec>({
      cached: [rec('1', '2026-09-09T10:00:00Z', 'old')],
      incoming: [rec('1', '2026-09-09T11:00:00Z', 'new')],
      tombstones: noTombstones,
      pendingIds: NONE,
      fullSync: true,
    });
    expect(r.merged).toHaveLength(1);
    expect(r.merged[0]?.title).toBe('new');
    expect(r.conflicts).toEqual([]);
  });

  it('keeps the local record when it is newer than the server (no clobber)', () => {
    const r = reconcile<Rec>({
      cached: [rec('1', 2000, 'local-newer')],
      incoming: [rec('1', 1000, 'server-stale')],
      tombstones: noTombstones,
      pendingIds: NONE,
      fullSync: true,
    });
    expect(r.merged[0]?.title).toBe('local-newer');
  });

  it('adds brand-new server records', () => {
    const r = reconcile<Rec>({
      cached: [],
      incoming: [rec('1', 1000, 'fresh')],
      tombstones: noTombstones,
      pendingIds: NONE,
      fullSync: false,
    });
    expect(r.merged.map((m) => m.id)).toEqual(['1']);
  });
});

describe('reconcile — soft-conflict', () => {
  it('flags an id kept as server (LWW) that had a pending local edit', () => {
    const r = reconcile<Rec>({
      cached: [rec('1', 1000, 'local-edit')],
      incoming: [rec('1', 2000, 'server-new')],
      tombstones: noTombstones,
      pendingIds: new Set(['1']),
      fullSync: false,
    });
    expect(r.merged[0]?.title).toBe('server-new'); // server wins
    expect(r.conflicts).toEqual(['1']); // but the collision is surfaced
  });

  it('does not flag a conflict when the server record is not newer', () => {
    const r = reconcile<Rec>({
      cached: [rec('1', 2000, 'local-edit')],
      incoming: [rec('1', 1000, 'server-stale')],
      tombstones: noTombstones,
      pendingIds: new Set(['1']),
      fullSync: false,
    });
    expect(r.conflicts).toEqual([]);
  });

  it('never flags a create-only (photo) entry with no cached counterpart', () => {
    // A queued photo create: pending id, server returns the created record,
    // cache has no prior version → merged, never a conflict.
    const r = reconcile<Rec>({
      cached: [],
      incoming: [rec('photo-1', 5000, 'evidence.jpg')],
      tombstones: noTombstones,
      pendingIds: new Set(['photo-1']),
      fullSync: false,
    });
    expect(r.merged.map((m) => m.id)).toEqual(['photo-1']);
    expect(r.conflicts).toEqual([]);
  });
});

describe('reconcile — tombstones', () => {
  it('suppresses resurrection of a tombstoned id in the incoming set', () => {
    const r = reconcile<Rec>({
      cached: [],
      incoming: [rec('1', 3000, 'server-copy')],
      tombstones: [{ entityType: 'task', id: '1', deletedAt: 2000 }],
      pendingIds: NONE,
      fullSync: true,
    });
    expect(r.merged).toEqual([]);
    expect(r.removed).toEqual([]); // suppressed, not a server delete
  });

  it('drops a locally-tombstoned cached record from the merge', () => {
    const r = reconcile<Rec>({
      cached: [rec('1', 1000, 'pending-delete')],
      incoming: [],
      tombstones: [{ entityType: 'task', id: '1', deletedAt: 2000 }],
      pendingIds: NONE,
      fullSync: true,
    });
    expect(r.merged).toEqual([]);
    expect(r.removed).toEqual([]);
  });
});

describe('reconcile — server delete (fullSync)', () => {
  it('removes a cached record absent from a full-list sync', () => {
    const r = reconcile<Rec>({
      cached: [rec('1', 1000, 'keep'), rec('2', 1000, 'server-deleted')],
      incoming: [rec('1', 1000, 'keep')],
      tombstones: noTombstones,
      pendingIds: NONE,
      fullSync: true,
    });
    expect(r.merged.map((m) => m.id)).toEqual(['1']);
    expect(r.removed).toEqual(['2']);
  });

  it('preserves unmentioned cached records on a partial sync', () => {
    const r = reconcile<Rec>({
      cached: [rec('1', 1000, 'keep'), rec('2', 1000, 'not-in-delta')],
      incoming: [rec('1', 1500, 'updated')],
      tombstones: noTombstones,
      pendingIds: NONE,
      fullSync: false,
    });
    expect(r.merged.map((m) => m.id).sort()).toEqual(['1', '2']);
    expect(r.removed).toEqual([]);
  });
});

describe('orphanPhotoFiles', () => {
  const HOUR = 3_600_000;
  const now = 10 * HOUR;

  function photoEntry(clientId: string, localUri: string): OutboxEntry {
    return {
      clientId,
      entityType: 'photo',
      op: 'create',
      payload: { taskId: 't1', localUri, mimeType: 'image/jpeg', capturedAt: 1 },
      createdAt: 1,
      status: 'pending',
      attempts: 0,
    };
  }

  it('keeps a file still referenced by a live photo/create entry', () => {
    const uri = 'file:///docs/photos/keep.jpg';
    const out = orphanPhotoFiles({
      photoFiles: [{ path: uri, modifiedAt: now - 5 * HOUR }], // old, but referenced
      entries: [photoEntry('a', uri)],
      now,
    });
    expect(out).toEqual([]);
  });

  it('deletes an unreferenced file older than the age guard', () => {
    const out = orphanPhotoFiles({
      photoFiles: [{ path: 'file:///docs/photos/orphan.jpg', modifiedAt: now - 5 * HOUR }],
      entries: [photoEntry('a', 'file:///docs/photos/other.jpg')],
      now,
    });
    expect(out).toEqual(['file:///docs/photos/orphan.jpg']);
  });

  it('keeps an unreferenced file that is too recent (capture→enqueue race)', () => {
    const out = orphanPhotoFiles({
      photoFiles: [{ path: 'file:///docs/photos/fresh.jpg', modifiedAt: now - 60_000 }], // 1 min old
      entries: [],
      now,
    });
    expect(out).toEqual([]);
  });

  it('ignores non-photo entries when computing references', () => {
    const uri = 'file:///docs/photos/x.jpg';
    const taskEntry: OutboxEntry = {
      clientId: 'z',
      entityType: 'task',
      op: 'update',
      payload: { localUri: uri }, // localUri on a NON-photo entry must not shield the file
      createdAt: 1,
      status: 'pending',
      attempts: 0,
    };
    const out = orphanPhotoFiles({
      photoFiles: [{ path: uri, modifiedAt: now - 5 * HOUR }],
      entries: [taskEntry],
      now,
    });
    expect(out).toEqual([uri]);
  });

  it('respects a custom minAgeMs', () => {
    const out = orphanPhotoFiles({
      photoFiles: [{ path: 'file:///docs/photos/a.jpg', modifiedAt: now - 90_000 }], // 90 s old
      entries: [],
      now,
      minAgeMs: 60_000, // 1 min guard -> 90 s file is an orphan
    });
    expect(out).toEqual(['file:///docs/photos/a.jpg']);
  });
});
