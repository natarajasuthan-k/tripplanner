import type { Env } from '../../src/env';

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://trip:trip@localhost:5432/tripplanner_test';

export const testEnv: Env = {
  DATABASE_URL: TEST_DATABASE_URL,
  GEOAPIFY_API_KEY: 'test-key',
  RESEND_API_KEY: 'test',
  EMAIL_HMAC_SECRET: 'test-secret-test-secret-test-secret',
  APP_PUBLIC_URL: 'http://localhost:5173',
  CORS_ORIGIN: 'http://localhost:5173',
  EMAIL_FROM: 'test@example.com',
  LOG_LEVEL: 'error',
  PROVIDER_MODE: 'fake',
  EMAIL_MODE: 'log',
};
