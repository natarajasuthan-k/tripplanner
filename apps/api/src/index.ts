import { createApp } from './app';
import { createDb } from './db/client';
import type { Env } from './env';
import { deleteExpiredCounters, deleteOldCache } from './repositories/cacheRepo';
import { deleteStalePresence } from './repositories/presenceRepo';

const app = createApp();

export default {
  fetch: app.fetch,

  // Hourly cleanup (backend-spec §10): stale presence, expired rate counters, old provider cache.
  async scheduled(_controller, env, _ctx) {
    const { db, close } = createDb(env.DATABASE_URL);
    try {
      await deleteStalePresence(db, 5 * 60);
      await deleteExpiredCounters(db);
      await deleteOldCache(db, 30);
    } finally {
      await close();
    }
  },
} satisfies ExportedHandler<Env>;
