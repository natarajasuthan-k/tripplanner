import { createMiddleware } from 'hono/factory';
import { createDb, type Db } from '../db/client';
import type { AppBindings, Env } from '../env';

export type DbFactory = (env: Env) => { db: Db; close: () => Promise<void> };

export const defaultDbFactory: DbFactory = (env) => createDb(env.DATABASE_URL);

/** Opens a per-request DB client (connects lazily on first query) and closes it afterwards. */
export function dbMiddleware(factory: DbFactory) {
  return createMiddleware<AppBindings>(async (c, next) => {
    const { db, close } = factory(c.env);
    c.set('db', db);
    try {
      await next();
    } finally {
      let ctx: { waitUntil(promise: Promise<unknown>): void } | null = null;
      try {
        ctx = c.executionCtx;
      } catch {
        // No ExecutionContext outside Workers (tests) — close inline.
      }
      if (ctx) ctx.waitUntil(close());
      else await close();
    }
  });
}
