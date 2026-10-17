import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import type { AppBindings, Env } from '../env';
import { cachedConfigProblems } from '../lib/config';
import { validationHook } from '../lib/validation';

export type PingDb = (env: Env) => Promise<void>;

const HealthSchema = z
  .object({
    status: z.enum(['ok', 'degraded']),
    db: z.enum(['ok', 'error']),
    config: z.enum(['ok', 'error']),
    time: z.string(),
  })
  .openapi('Health');

const route = createRoute({
  method: 'get',
  path: '/health',
  tags: ['System'],
  summary: 'E1 — Liveness and database check',
  responses: {
    200: {
      description: 'API and database are up',
      content: { 'application/json': { schema: HealthSchema } },
    },
    503: {
      description: 'Database unreachable or configuration invalid (details are only logged)',
      content: { 'application/json': { schema: HealthSchema } },
    },
  },
});

export function healthRoutes(pingDb: PingDb) {
  return new OpenAPIHono<AppBindings>({ defaultHook: validationHook }).openapi(route, async (c) => {
    const time = new Date().toISOString();
    const config = cachedConfigProblems(c.env).length === 0 ? ('ok' as const) : ('error' as const);
    let db: 'ok' | 'error' = 'ok';
    try {
      await pingDb(c.env);
    } catch {
      db = 'error';
    }
    const ok = db === 'ok' && config === 'ok';
    return c.json(
      { status: ok ? ('ok' as const) : ('degraded' as const), db, config, time },
      ok ? 200 : 503,
    );
  });
}
