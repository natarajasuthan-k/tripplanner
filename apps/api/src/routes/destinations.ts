import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import {
  destinationSearchResponseSchema,
  placesResponseSchema,
  searchQuerySchema,
} from '@tripplanner/shared';
import type { AppBindings } from '../env';
import { validationHook } from '../lib/validation';
import { rateLimit } from '../middleware/rateLimit';
import { searchDestinations } from '../services/destinationService';
import { getPlaces } from '../services/placesService';
import { notFound } from '../lib/errors';
import { errorResponse } from './common';

const searchRoute = createRoute({
  method: 'get',
  path: '/destinations/search',
  tags: ['Destinations'],
  summary: 'E2 — Destination suggestions',
  middleware: [rateLimit('RL_SEARCH')] as const,
  request: {
    query: z.object({
      q: searchQuerySchema,
      limit: z.coerce.number().int().min(1).max(10).default(6),
    }),
  },
  responses: {
    200: {
      description: 'Matching destinations (may be empty)',
      content: { 'application/json': { schema: destinationSearchResponseSchema } },
    },
    400: errorResponse('VALIDATION_ERROR'),
    429: errorResponse('RATE_LIMITED'),
    503: errorResponse('PROVIDER_UNAVAILABLE'),
  },
});

const placesRoute = createRoute({
  method: 'get',
  path: '/destinations/{destinationId}/places',
  tags: ['Destinations'],
  summary: 'E3 — Places of interest (7-day cache, stale fallback)',
  middleware: [rateLimit('RL_READ')] as const,
  request: {
    params: z.object({
      destinationId: z.string().openapi({ param: { name: 'destinationId', in: 'path' } }),
    }),
    query: z.object({ limit: z.coerce.number().int().min(1).max(50).default(30) }),
  },
  responses: {
    200: {
      description: 'Places; show `attribution` in the UI',
      content: { 'application/json': { schema: placesResponseSchema } },
    },
    404: errorResponse('NOT_FOUND'),
    503: errorResponse('PROVIDER_UNAVAILABLE'),
  },
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function destinationRoutes(fetchFn?: typeof fetch) {
  return new OpenAPIHono<AppBindings>({ defaultHook: validationHook })
    .openapi(searchRoute, async (c) => {
      const { q, limit } = c.req.valid('query');
      const items = await searchDestinations(c.var.db, c.env, q, limit, fetchFn);
      c.header('Cache-Control', 'public, max-age=60');
      return c.json({ items }, 200);
    })
    .openapi(placesRoute, async (c) => {
      const { destinationId } = c.req.valid('param');
      if (!UUID.test(destinationId)) throw notFound('Destination not found');
      const res = await getPlaces(
        c.var.db,
        c.env,
        destinationId,
        c.req.valid('query').limit,
        fetchFn,
      );
      c.header('Cache-Control', 'public, max-age=3600');
      return c.json(res, 200);
    });
}
