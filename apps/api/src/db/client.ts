import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

/**
 * Per-request database client. Workers can't hold connections across requests, so each request
 * opens one short-lived connection and closes it with `close()` (pass to `ctx.waitUntil`).
 * Works with Neon (TLS via `sslmode=require` in the URL) and local Docker Postgres.
 */
export function createDb(databaseUrl: string) {
  const sql = postgres(databaseUrl, { max: 1, prepare: false, fetch_types: false });
  const db = drizzle(sql, { schema });
  return { db, sql, close: () => sql.end({ timeout: 5 }) };
}

export type Db = ReturnType<typeof createDb>['db'];
