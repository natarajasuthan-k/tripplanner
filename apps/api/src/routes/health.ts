import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import type { AppBindings, Env } from '../env';
import { validationHook } from '../lib/validation';

export type PingDb = (env: Env) => Promise<void>;

const HealthSchema = z
  .object({
    status: z.enum(['ok', 'degraded']),
    db: z.enum(['ok', 'error']),
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
      description: 'Database unreachable',
      content: { 'application/json': { schema: HealthSchema } },
    },
  },
});

export function healthRoutes(pingDb: PingDb) {
  return new OpenAPIHono<AppBindings>({ defaultHook: validationHook }).openapi(route, async (c) => {
    const time = new Date().toISOString();
    try {
      await pingDb(c.env);
      return c.json({ status: 'ok' as const, db: 'ok' as const, time }, 200);
    } catch {
      return c.json({ status: 'degraded' as const, db: 'error' as const, time }, 503);
    }
  });
}
