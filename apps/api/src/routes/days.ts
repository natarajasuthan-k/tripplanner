import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import {
  presenceRequestSchema,
  saveDayRequestSchema,
  saveDayResponseSchema,
  SESSION_ID_MAX,
  SESSION_ID_MIN,
} from '@tripplanner/shared';
import type { AppBindings } from '../env';
import { sessionIdOf } from '../lib/http';
import { validationHook } from '../lib/validation';
import { rateLimit } from '../middleware/rateLimit';
import { requireRole, tripDay } from '../middleware/tripAccess';
import { recordContribution } from '../services/contributorService';
import { heartbeat, saveDay, stopEditing } from '../services/dayService';
import { errorResponse, tokenDayParams } from './common';

const editors = ['organiser', 'editor'] as const;

const saveRoute = createRoute({
  method: 'put',
  path: '/trips/{token}/days/{dayId}',
  tags: ['Days'],
  summary: 'E10 — Save a day’s text (optimistic concurrency)',
  middleware: [rateLimit('RL_WRITE'), requireRole(...editors), tripDay] as const,
  request: {
    params: tokenDayParams,
    body: { required: true, content: { 'application/json': { schema: saveDayRequestSchema } } },
  },
  responses: {
    200: {
      description: 'Saved; version incremented',
      content: { 'application/json': { schema: saveDayResponseSchema } },
    },
    400: errorResponse('VALIDATION_ERROR'),
    403: errorResponse('FORBIDDEN'),
    404: errorResponse('NOT_FOUND'),
    409: errorResponse('TRIP_COMPLETED | DAY_VERSION_CONFLICT (details.current)'),
    429: errorResponse('RATE_LIMITED'),
  },
});

const presenceRoute = createRoute({
  method: 'put',
  path: '/trips/{token}/days/{dayId}/presence',
  tags: ['Days'],
  summary: 'E11 — "I’m editing" heartbeat',
  middleware: [rateLimit('RL_PRESENCE'), requireRole(...editors), tripDay] as const,
  request: {
    params: tokenDayParams,
    body: { required: true, content: { 'application/json': { schema: presenceRequestSchema } } },
  },
  responses: {
    204: { description: 'Recorded' },
    400: errorResponse('VALIDATION_ERROR'),
    403: errorResponse('FORBIDDEN'),
    404: errorResponse('NOT_FOUND'),
    409: errorResponse('TRIP_COMPLETED'),
    429: errorResponse('RATE_LIMITED'),
  },
});

const stopRoute = createRoute({
  method: 'delete',
  path: '/trips/{token}/days/{dayId}/presence/{sessionId}',
  tags: ['Days'],
  summary: 'E12 — "I’ve stopped editing"',
  middleware: [rateLimit('RL_PRESENCE'), requireRole(...editors), tripDay] as const,
  request: {
    params: tokenDayParams.extend({
      sessionId: z
        .string()
        .min(SESSION_ID_MIN)
        .max(SESSION_ID_MAX)
        .openapi({ param: { name: 'sessionId', in: 'path' } }),
    }),
  },
  responses: {
    204: { description: 'Removed (idempotent)' },
    403: errorResponse('FORBIDDEN'),
    404: errorResponse('NOT_FOUND'),
    409: errorResponse('TRIP_COMPLETED'),
  },
});

export function dayRoutes() {
  return new OpenAPIHono<AppBindings>({ defaultHook: validationHook })
    .openapi(saveRoute, async (c) => {
      const input = c.req.valid('json');
      const day = await saveDay(c.var.db, c.var.trip, c.var.day, input, sessionIdOf(c));
      await recordContribution(c.var.db, c.env.EMAIL_HMAC_SECRET, c.var.trip.id, input.editorName);
      return c.json({ day }, 200);
    })
    .openapi(presenceRoute, async (c) => {
      await heartbeat(c.var.db, c.var.trip, c.var.day, c.req.valid('json'));
      return c.body(null, 204);
    })
    .openapi(stopRoute, async (c) => {
      await stopEditing(c.var.db, c.var.trip, c.var.day, c.req.valid('param').sessionId);
      return c.body(null, 204);
    });
}
