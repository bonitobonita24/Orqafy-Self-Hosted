// expo-sqlite implementations of the offline *Store interfaces (chunk 2).
//
// ADAPTER module: imports the `SQLiteDatabase` type from `expo-sqlite` and is
// typecheck-only here. Pure logic (outbox/reconcile/sync-engine) never imports
// this file; only the app wiring does, via `./offline/sqlite`.

import type { SQLiteDatabase } from 'expo-sqlite';

import type {
  CacheStore,
  OutboxEntry,
  OutboxOp,
  OutboxStatus,
  OutboxStore,
  SyncableRecord,
  Tombstone,
  TombstoneStore,
} from '../types';

interface CacheRow {
  json: string;
}

interface OutboxRow {
  client_id: string;
  entity_type: string;
  op: string;
  payload_json: string;
  created_at: number;
  status: string;
  attempts: number;
  last_error: string | null;
}

interface TombstoneRow {
  entity_type: string;
  id: string;
  deleted_at: number;
}

/** Cache of server records, JSON-serialised per row. */
export class SqliteCacheStore<T extends SyncableRecord = SyncableRecord>
  implements CacheStore<T>
{
  constructor(private readonly db: SQLiteDatabase) {}

  async get(entityType: string, id: string): Promise<T | null> {
    const row = await this.db.getFirstAsync<CacheRow>(
      'SELECT json FROM cache_records WHERE entity_type = ? AND id = ?',
      entityType,
      id,
    );
    return row ? (JSON.parse(row.json) as T) : null;
  }

  async list(entityType: string): Promise<T[]> {
    const rows = await this.db.getAllAsync<CacheRow>(
      'SELECT json FROM cache_records WHERE entity_type = ?',
      entityType,
    );
    return rows.map((r) => JSON.parse(r.json) as T);
  }

  async put(entityType: string, record: T): Promise<void> {
    await this.db.runAsync(
      'INSERT OR REPLACE INTO cache_records (entity_type, id, updated_at, json) VALUES (?, ?, ?, ?)',
      entityType,
      record.id,
      String(record.updatedAt),
      JSON.stringify(record),
    );
  }

  async putMany(entityType: string, records: T[]): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      for (const record of records) await this.put(entityType, record);
    });
  }

  async delete(entityType: string, id: string): Promise<void> {
    await this.db.runAsync(
      'DELETE FROM cache_records WHERE entity_type = ? AND id = ?',
      entityType,
      id,
    );
  }

  async clear(entityType: string): Promise<void> {
    await this.db.runAsync('DELETE FROM cache_records WHERE entity_type = ?', entityType);
  }
}

function rowToEntry(row: OutboxRow): OutboxEntry {
  const entry: OutboxEntry = {
    clientId: row.client_id,
    entityType: row.entity_type,
    op: row.op as OutboxOp,
    payload: JSON.parse(row.payload_json),
    createdAt: row.created_at,
    status: row.status as OutboxStatus,
    attempts: row.attempts,
  };
  if (row.last_error !== null) entry.lastError = row.last_error;
  return entry;
}

/** Durable, ordered outbound mutation queue. */
export class SqliteOutboxStore implements OutboxStore {
  constructor(private readonly db: SQLiteDatabase) {}

  async list(): Promise<OutboxEntry[]> {
    const rows = await this.db.getAllAsync<OutboxRow>(
      'SELECT * FROM outbox ORDER BY created_at ASC, client_id ASC',
    );
    return rows.map(rowToEntry);
  }

  async put(entry: OutboxEntry): Promise<void> {
    await this.db.runAsync(
      'INSERT OR REPLACE INTO outbox (client_id, entity_type, op, payload_json, created_at, status, attempts, last_error) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      entry.clientId,
      entry.entityType,
      entry.op,
      JSON.stringify(entry.payload ?? null),
      entry.createdAt,
      entry.status,
      entry.attempts,
      entry.lastError ?? null,
    );
  }

  async putMany(entries: OutboxEntry[]): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      for (const entry of entries) await this.put(entry);
    });
  }

  async delete(clientId: string): Promise<void> {
    await this.db.runAsync('DELETE FROM outbox WHERE client_id = ?', clientId);
  }

  async clear(): Promise<void> {
    await this.db.runAsync('DELETE FROM outbox');
  }
}

/** Local delete markers. */
export class SqliteTombstoneStore implements TombstoneStore {
  constructor(private readonly db: SQLiteDatabase) {}

  async list(entityType?: string): Promise<Tombstone[]> {
    const rows = entityType !== undefined
      ? await this.db.getAllAsync<TombstoneRow>(
          'SELECT * FROM tombstones WHERE entity_type = ?',
          entityType,
        )
      : await this.db.getAllAsync<TombstoneRow>('SELECT * FROM tombstones');
    return rows.map((r) => ({ entityType: r.entity_type, id: r.id, deletedAt: r.deleted_at }));
  }

  async put(tombstone: Tombstone): Promise<void> {
    await this.db.runAsync(
      'INSERT OR REPLACE INTO tombstones (entity_type, id, deleted_at) VALUES (?, ?, ?)',
      tombstone.entityType,
      tombstone.id,
      tombstone.deletedAt,
    );
  }

  async delete(entityType: string, id: string): Promise<void> {
    await this.db.runAsync(
      'DELETE FROM tombstones WHERE entity_type = ? AND id = ?',
      entityType,
      id,
    );
  }

  async clear(): Promise<void> {
    await this.db.runAsync('DELETE FROM tombstones');
  }
}
