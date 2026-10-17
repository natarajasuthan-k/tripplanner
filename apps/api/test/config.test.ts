import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import type { Env } from '../src/env';
import { configProblems } from '../src/lib/config';
import { testEnv } from './helpers/env';

const production: Env = {
  ...testEnv,
  ENVIRONMENT: 'production',
  APP_PUBLIC_URL: 'https://tripplanner.pages.dev',
  CORS_ORIGIN: 'https://tripplanner.pages.dev',
  PROVIDER_MODE: 'live',
  EMAIL_MODE: 'live',
  GEOAPIFY_API_KEY: 'geo-real-key',
  RESEND_API_KEY: 're_real_key',
  EMAIL_FROM: 'Trip Planner <links@trip.example>',
  EMAIL_HMAC_SECRET: 'a'.repeat(43),
};

describe('configProblems (backend-spec §9)', () => {
  it('accepts a complete production config and the test config', () => {
    expect(configProblems(production)).toEqual([]);
    expect(configProblems(testEnv)).toEqual([]);
  });

  it('rejects fake providers, log-only email and http origins in production', () => {
    const problems = configProblems({
      ...production,
      PROVIDER_MODE: 'fake',
      EMAIL_MODE: 'log',
      CORS_ORIGIN: 'http://tripplanner.pages.dev',
    });
    expect(problems).toEqual(
      expect.arrayContaining([
        'PROVIDER_MODE must be "live" in production',
        'EMAIL_MODE must be "live" in production',
        'CORS_ORIGIN is not a valid URL',
      ]),
    );
  });

  it('rejects short or placeholder secrets and missing keys', () => {
    expect(configProblems({ ...production, EMAIL_HMAC_SECRET: 'short' })).toContain(
      'EMAIL_HMAC_SECRET must be at least 32 characters',
    );
    expect(
      configProblems({ ...production, EMAIL_HMAC_SECRET: 'replace-me-with-32-plus-random-bytes' }),
    ).toContain('EMAIL_HMAC_SECRET is a placeholder');
    expect(configProblems({ ...production, GEOAPIFY_API_KEY: 'replace-me' })).toContain(
      'GEOAPIFY_API_KEY is missing',
    );
    expect(configProblems({ ...production, RESEND_API_KEY: '' })).toContain(
      'RESEND_API_KEY is missing',
    );
  });
});

describe('misconfigured service', () => {
  const bad: Env = { ...production, PROVIDER_MODE: 'fake' };
  const app = createApp({ pingDb: async () => {} });

  it('reports config errors on /health without revealing details', async () => {
    const res = await app.request('/api/v1/health', {}, bad);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toMatchObject({ status: 'degraded', db: 'ok', config: 'error' });
    expect(JSON.stringify(body)).not.toContain('PROVIDER_MODE');
  });

  it('refuses other requests', async () => {
    const res = await app.request('/api/v1/destinations/search?q=kyoto', {}, bad);
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: { code: 'INTERNAL_ERROR' } });
  });
});
