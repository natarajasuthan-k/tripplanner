import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { testEnv as env } from './helpers/env';

describe('E1 GET /api/v1/health', () => {
  it('returns ok when the database answers', async () => {
    const app = createApp({ pingDb: async () => {} });
    const res = await app.request('/api/v1/health', {}, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: 'ok', db: 'ok' });
  });

  it('returns 503 degraded when the database is unreachable', async () => {
    const app = createApp({
      pingDb: async () => {
        throw new Error('down');
      },
    });
    const res = await app.request('/api/v1/health', {}, env);
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ status: 'degraded', db: 'error' });
  });
});

describe('cross-cutting behaviour', () => {
  const app = createApp({ pingDb: async () => {} });

  it('uses the standard error shape for unknown routes', async () => {
    const res = await app.request('/api/v1/nope', {}, env);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: { code: 'NOT_FOUND', message: 'Not found', details: null },
    });
  });

  it('sets security headers and a request id', async () => {
    const res = await app.request('/api/v1/health', {}, env);
    expect(res.headers.get('Referrer-Policy')).toBe('no-referrer');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('X-Request-Id')).toMatch(/.+/);
  });

  it('echoes a valid incoming X-Request-Id', async () => {
    const res = await app.request(
      '/api/v1/health',
      { headers: { 'X-Request-Id': 'abc-123' } },
      env,
    );
    expect(res.headers.get('X-Request-Id')).toBe('abc-123');
  });

  it('allows CORS only for the configured origin', async () => {
    const ok = await app.request(
      '/api/v1/health',
      { headers: { Origin: 'http://localhost:5173' } },
      env,
    );
    expect(ok.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');

    const other = await app.request(
      '/api/v1/health',
      { headers: { Origin: 'https://evil.example' } },
      env,
    );
    expect(other.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('serves the OpenAPI document', async () => {
    const res = await app.request('/api/v1/openapi.json', {}, env);
    expect(res.status).toBe(200);
    const doc = (await res.json()) as { paths: Record<string, unknown> };
    expect(Object.keys(doc.paths)).toContain('/health');
  });
});
