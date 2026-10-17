import { createApp } from './app';
import type { Env } from './env';

const app = createApp();

export default {
  fetch: app.fetch,

  // Hourly cleanup (backend-spec §10): stale presence, expired rate counters, old provider cache.
  async scheduled(_controller, _env, _ctx) {
    // Implemented with the presence / rate-limit / cache features.
  },
} satisfies ExportedHandler<Env>;
