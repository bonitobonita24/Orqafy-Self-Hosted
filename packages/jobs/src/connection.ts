// Valkey/Redis connection wiring for BullMQ. Orqafy uses Valkey (an
// open-source Redis fork) as the queue backend; BullMQ speaks the Redis
// protocol either way.

import type { ConnectionOptions } from 'bullmq';

export interface JobsConnectionInput {
  /** A `redis://` / `valkey://` URL (e.g. `VALKEY_URL`). Takes precedence. */
  url?: string | undefined;
  host?: string | undefined;
  port?: number | undefined;
  password?: string | undefined;
  db?: number | undefined;
}

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 6379;

/** Parse a redis/valkey URL into BullMQ `ConnectionOptions`. */
export function connectionFromUrl(url: string): ConnectionOptions {
  const parsed = new URL(url);
  const port = parsed.port.length > 0 ? Number(parsed.port) : DEFAULT_PORT;
  const db = parsed.pathname.length > 1 ? Number(parsed.pathname.slice(1)) : 0;
  return {
    host: parsed.hostname.length > 0 ? parsed.hostname : DEFAULT_HOST,
    port,
    ...(parsed.password.length > 0 ? { password: parsed.password } : {}),
    ...(Number.isNaN(db) ? {} : { db }),
  };
}

/** Build `ConnectionOptions` from explicit fields, URL, or env fallbacks. */
export function createConnection(input: JobsConnectionInput = {}): ConnectionOptions {
  if (input.url !== undefined && input.url.length > 0) {
    return connectionFromUrl(input.url);
  }
  return {
    host: input.host ?? DEFAULT_HOST,
    port: input.port ?? DEFAULT_PORT,
    ...(input.password !== undefined ? { password: input.password } : {}),
    ...(input.db !== undefined ? { db: input.db } : {}),
  };
}

/** Convenience: read `VALKEY_URL` / `REDIS_URL` from the environment. */
export function connectionFromEnv(env: NodeJS.ProcessEnv = process.env): ConnectionOptions {
  const url = env['VALKEY_URL'] ?? env['REDIS_URL'];
  if (url !== undefined && url.length > 0) {
    return connectionFromUrl(url);
  }
  return createConnection();
}
