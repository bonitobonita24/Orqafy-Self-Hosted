// expo-sqlite backing store for the offline data layer.
//
// ADAPTER module: imports `expo-sqlite` and is typecheck-only here (no device /
// simulator in this environment). Pure consumers must NOT import this file —
// reach it explicitly via `./offline/sqlite`.

import * as SQLite from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

const DATABASE_NAME = 'orqafy.db';

let databasePromise: Promise<SQLiteDatabase> | null = null;

/** Open (once) and return the shared device database, migrated. */
export async function getDatabase(): Promise<SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync(DATABASE_NAME).then(async (db) => {
      await migrate(db);
      return db;
    });
  }
  return databasePromise;
}

/**
 * Create the offline tables if absent (idempotent):
 * - `cache_records` — server read model, keyed by (entity_type, id).
 * - `outbox` — durable, ordered local mutation queue, keyed by client_id.
 * - `tombstones` — local delete markers, keyed by (entity_type, id).
 * - `sync_meta` — per-entity last-sync checkpoints and misc key/value state.
 */
export async function migrate(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS cache_records (
      entity_type TEXT NOT NULL,
      id          TEXT NOT NULL,
      updated_at  TEXT NOT NULL,
      json        TEXT NOT NULL,
      PRIMARY KEY (entity_type, id)
    );

    CREATE TABLE IF NOT EXISTS outbox (
      client_id    TEXT PRIMARY KEY,
      entity_type  TEXT NOT NULL,
      op           TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at   INTEGER NOT NULL,
      status       TEXT NOT NULL,
      attempts     INTEGER NOT NULL DEFAULT 0,
      last_error   TEXT
    );

    CREATE TABLE IF NOT EXISTS tombstones (
      entity_type TEXT NOT NULL,
      id          TEXT NOT NULL,
      deleted_at  INTEGER NOT NULL,
      PRIMARY KEY (entity_type, id)
    );

    CREATE TABLE IF NOT EXISTS sync_meta (
      key   TEXT PRIMARY KEY,
      value TEXT
    );
  `);
}
