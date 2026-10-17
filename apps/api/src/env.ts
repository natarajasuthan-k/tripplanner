// Worker bindings — wrangler.jsonc + secrets (backend-spec §9).

export interface Env {
  // Secrets
  DATABASE_URL: string;
  GEOAPIFY_API_KEY: string;
  RESEND_API_KEY: string;
  EMAIL_HMAC_SECRET: string;

  // Vars
  APP_PUBLIC_URL: string;
  CORS_ORIGIN: string;
  EMAIL_FROM: string;
  LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';

  // Rate-limit bindings (optional so tests can omit them)
  RL_READ?: RateLimit;
  RL_WRITE?: RateLimit;
  RL_PRESENCE?: RateLimit;
  RL_SEARCH?: RateLimit;
}

export interface Variables {
  requestId: string;
}

export interface AppBindings {
  Bindings: Env;
  Variables: Variables;
}
