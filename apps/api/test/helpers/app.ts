// Integration-test harness: one shared DB connection, tables truncated before each test.
import { sql } from 'drizzle-orm';
import { afterAll, beforeEach } from 'vitest';
import { createApp, type AppDeps } from '../../src/app';
import { createDb } from '../../src/db/client';
import { testEnv, TEST_DATABASE_URL } from './env';

export const { db, close } = createDb(TEST_DATABASE_URL);

export function setupDb() {
  beforeEach(async () => {
    await db.execute(
      sql`TRUNCATE destinations, trips, days, day_presence, delete_requests, provider_cache,
          trip_slug_history, rate_counters, trip_contributors RESTART IDENTITY CASCADE`,
    );
  });
  afterAll(async () => {
    await close();
  });
}

export function makeApp(deps: Partial<AppDeps> = {}) {
  const app = createApp({
    pingDb: async () => {},
    dbFactory: () => ({ db, close: async () => {} }),
    ...deps,
  });

  type Init = { method?: string; body?: unknown; headers?: Record<string, string> };
  const request = (path: string, init: Init = {}) =>
    app.request(
      `/api/v1${path}`,
      {
        method: init.method ?? 'GET',
        headers: {
          ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...init.headers,
        },
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      },
      testEnv,
    );
  return { app, request };
}
