// Worker bindings — wrangler.jsonc + secrets (backend-spec §9).
import type { Role } from '@tripplanner/shared';
import type { Db } from './db/client';
import type { DayRow } from './repositories/dayRepo';
import type { TripRow } from './repositories/tripRepo';

export interface Env {
  // Secrets
  DATABASE_URL: string;
  GEOAPIFY_API_KEY: string;
  RESEND_API_KEY: string;
  EMAIL_HMAC_SECRET: string;

  // Vars
  /** `production` enforces live providers, HTTPS origins and real secrets (lib/config.ts). */
  ENVIRONMENT: 'development' | 'test' | 'production';
  APP_PUBLIC_URL: string;
  CORS_ORIGIN: string;
  EMAIL_FROM: string;
  LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
  /** `fake` serves built-in fixture destinations (local dev, tests); `live` calls Geoapify. */
  PROVIDER_MODE: 'live' | 'fake';
  /** `live` sends via Resend; `log` only logs a redacted line (local dev, tests). */
  EMAIL_MODE: 'live' | 'log';

  // Rate-limit bindings (optional so tests can omit them)
  RL_READ?: RateLimit;
  RL_WRITE?: RateLimit;
  RL_PRESENCE?: RateLimit;
  RL_SEARCH?: RateLimit;
}

export interface Variables {
  requestId: string;
  db: Db;
  /** Set by `tripAccess` for /trips/{token}/… routes. */
  trip: TripRow;
  role: Exclude<Role, 'public'>;
  /** Set by `tripDay` for /trips/{token}/days/{dayId}/… routes. */
  day: DayRow;
}

export interface AppBindings {
  Bindings: Env;
  Variables: Variables;
}
