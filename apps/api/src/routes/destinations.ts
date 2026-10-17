import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { destinationSearchResponseSchema, searchQuerySchema } from '@tripplanner/shared';
import type { AppBindings } from '../env';
import { validationHook } from '../lib/validation';
import { rateLimit } from '../middleware/rateLimit';
import { searchDestinations } from '../services/destinationService';
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

export function destinationRoutes(fetchFn?: typeof fetch) {
  return new OpenAPIHono<AppBindings>({ defaultHook: validationHook }).openapi(
    searchRoute,
    async (c) => {
      const { q, limit } = c.req.valid('query');
      const items = await searchDestinations(c.var.db, c.env, q, limit, fetchFn);
      c.header('Cache-Control', 'public, max-age=60');
      return c.json({ items }, 200);
    },
  );
}
