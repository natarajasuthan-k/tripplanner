import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import {
  deleteRequestResponseSchema,
  deleteRequestSchema,
  dismissResponseSchema,
} from '@tripplanner/shared';
import type { AppBindings } from '../env';
import { validationHook } from '../lib/validation';
import { rateLimit } from '../middleware/rateLimit';
import { requireRole } from '../middleware/tripAccess';
import { dismissAll, requestDeletion } from '../services/deleteRequestService';
import { errorResponse, tokenParam } from './common';

const createRequestRoute = createRoute({
  method: 'post',
  path: '/trips/{token}/delete-requests',
  tags: ['Delete requests'],
  summary: 'E13 — Ask the organiser to delete the trip',
  middleware: [rateLimit('RL_WRITE'), requireRole('editor')] as const,
  request: {
    params: tokenParam,
    body: { required: true, content: { 'application/json': { schema: deleteRequestSchema } } },
  },
  responses: {
    201: {
      description: 'Request recorded',
      content: { 'application/json': { schema: deleteRequestResponseSchema } },
    },
    400: errorResponse('VALIDATION_ERROR'),
    403: errorResponse('FORBIDDEN'),
    404: errorResponse('NOT_FOUND'),
    429: errorResponse('RATE_LIMITED'),
  },
});

const dismissRoute = createRoute({
  method: 'post',
  path: '/trips/{token}/delete-requests/dismiss',
  tags: ['Delete requests'],
  summary: 'E14 — Dismiss all pending requests',
  middleware: [rateLimit('RL_WRITE'), requireRole('organiser')] as const,
  request: { params: tokenParam },
  responses: {
    200: {
      description: 'Number dismissed',
      content: { 'application/json': { schema: dismissResponseSchema } },
    },
    403: errorResponse('FORBIDDEN'),
    404: errorResponse('NOT_FOUND'),
  },
});

export function deleteRequestRoutes() {
  return new OpenAPIHono<AppBindings>({ defaultHook: validationHook })
    .openapi(createRequestRoute, async (c) => {
      const { requestedByName } = c.req.valid('json');
      const deleteRequest = await requestDeletion(c.var.db, c.var.trip, requestedByName);
      return c.json({ deleteRequest }, 201);
    })
    .openapi(dismissRoute, async (c) => {
      const dismissedCount = await dismissAll(c.var.db, c.var.trip);
      return c.json({ dismissedCount }, 200);
    });
}
