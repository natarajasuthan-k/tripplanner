import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import {
  publicTripResponseSchema,
  publishedTripsQuerySchema,
  tripSummaryPageSchema,
} from '@tripplanner/shared';
import type { AppBindings } from '../env';
import { validationHook } from '../lib/validation';
import { rateLimit } from '../middleware/rateLimit';
import { getPublishedTrip, listPublishedTrips } from '../services/publishedService';
import { errorResponse } from './common';

// Registered BEFORE /trips/{token} (api-contract §4 routing note).

const listRoute = createRoute({
  method: 'get',
  path: '/trips/published',
  tags: ['Published'],
  summary: 'E15 — Published trips directory / earlier trips for a destination',
  middleware: [rateLimit('RL_READ')] as const,
  request: { query: publishedTripsQuerySchema },
  responses: {
    200: {
      description: 'Page of published trips, newest first',
      content: { 'application/json': { schema: tripSummaryPageSchema } },
    },
    400: errorResponse('VALIDATION_ERROR'),
    429: errorResponse('RATE_LIMITED'),
  },
});

const getRoute = createRoute({
  method: 'get',
  path: '/trips/published/{slug}',
  tags: ['Published'],
  summary: 'E16 — A published trip, read-only (old slugs resolve via canonicalSlug)',
  middleware: [rateLimit('RL_READ')] as const,
  request: {
    params: z.object({
      slug: z
        .string()
        .min(1)
        .max(120)
        .openapi({ param: { name: 'slug', in: 'path' } }),
    }),
  },
  responses: {
    200: {
      description: 'Published trip',
      content: { 'application/json': { schema: publicTripResponseSchema } },
    },
    404: errorResponse('NOT_FOUND'),
  },
});

export function publishedRoutes() {
  return new OpenAPIHono<AppBindings>({ defaultHook: validationHook })
    .openapi(listRoute, async (c) => {
      const page = await listPublishedTrips(c.var.db, c.req.valid('query'));
      c.header('Cache-Control', 'public, max-age=60');
      return c.json(page, 200);
    })
    .openapi(getRoute, async (c) => {
      const res = await getPublishedTrip(c.var.db, c.req.valid('param').slug);
      c.header('Cache-Control', 'public, max-age=60');
      return c.json(res, 200);
    });
}
