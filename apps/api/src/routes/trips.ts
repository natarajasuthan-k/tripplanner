import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import {
  createTripRequestSchema,
  createTripResponseSchema,
  tripResponseSchema,
  tripStatusResponseSchema,
  updateTripRequestSchema,
} from '@tripplanner/shared';
import type { AppBindings } from '../env';
import type { SendEmail } from '../integrations/email';
import { emailHash } from '../lib/hmac';
import { clientIp, sessionIdOf } from '../lib/http';
import { shortHash } from '../lib/ids';
import { validationHook } from '../lib/validation';
import { rateLimit } from '../middleware/rateLimit';
import { requireRole } from '../middleware/tripAccess';
import { publish } from '../services/publishedService';
import { sendOrganiserLink } from '../services/recoveryService';
import { createTrip, deleteTrip, getTripView, updateTrip } from '../services/tripService';
import { accessFor } from '../services/views';
import { errorResponse, tokenParam } from './common';

const createRouteDef = createRoute({
  method: 'post',
  path: '/trips',
  tags: ['Trips'],
  summary: 'E4 — Create a trip (optionally copying a published plan)',
  middleware: [rateLimit('RL_WRITE')] as const,
  request: {
    body: { required: true, content: { 'application/json': { schema: createTripRequestSchema } } },
  },
  responses: {
    201: {
      description: 'Trip created (organiser view, with all three codes)',
      content: { 'application/json': { schema: createTripResponseSchema } },
    },
    400: errorResponse('VALIDATION_ERROR'),
    404: errorResponse('NOT_FOUND (copyFromSlug unknown or unpublished)'),
    409: errorResponse('TRIP_NAME_TAKEN'),
    429: errorResponse('RATE_LIMITED'),
  },
});

const getRouteDef = createRoute({
  method: 'get',
  path: '/trips/{token}',
  tags: ['Trips'],
  summary: 'E5 — Get a trip as the caller’s role',
  middleware: [rateLimit('RL_READ')] as const,
  request: { params: tokenParam },
  responses: {
    200: {
      description: 'Trip view; weak ETag header',
      content: { 'application/json': { schema: tripResponseSchema } },
    },
    304: { description: 'Not modified (If-None-Match matched)' },
    404: errorResponse('NOT_FOUND'),
    429: errorResponse('RATE_LIMITED'),
  },
});

const patchRouteDef = createRoute({
  method: 'patch',
  path: '/trips/{token}',
  tags: ['Trips'],
  summary: 'E6 — Edit name, destination or dates',
  middleware: [rateLimit('RL_WRITE'), requireRole('organiser')] as const,
  request: {
    params: tokenParam,
    body: { required: true, content: { 'application/json': { schema: updateTripRequestSchema } } },
  },
  responses: {
    200: {
      description: 'Updated trip (version incremented)',
      content: { 'application/json': { schema: tripResponseSchema } },
    },
    400: errorResponse('VALIDATION_ERROR'),
    403: errorResponse('FORBIDDEN'),
    404: errorResponse('NOT_FOUND'),
    409: errorResponse(
      'TRIP_COMPLETED | TRIP_VERSION_CONFLICT | TRIP_NAME_TAKEN | DAYS_WOULD_BE_REMOVED',
    ),
  },
});

const deleteRouteDef = createRoute({
  method: 'delete',
  path: '/trips/{token}',
  tags: ['Trips'],
  summary: 'E7 — Delete the trip (also approves delete requests)',
  middleware: [rateLimit('RL_WRITE'), requireRole('organiser')] as const,
  request: { params: tokenParam },
  responses: {
    204: { description: 'Deleted' },
    403: errorResponse('FORBIDDEN'),
    404: errorResponse('NOT_FOUND'),
  },
});

const publishRouteDef = (published: boolean) =>
  createRoute({
    method: 'post',
    path: published ? '/trips/{token}/publish' : '/trips/{token}/unpublish',
    tags: ['Trips'],
    summary: published ? 'E8 — Publish' : 'E9 — Un-publish',
    middleware: [rateLimit('RL_WRITE'), requireRole('organiser')] as const,
    request: { params: tokenParam },
    responses: {
      200: {
        description: 'New status',
        content: { 'application/json': { schema: tripStatusResponseSchema } },
      },
      403: errorResponse('FORBIDDEN'),
      404: errorResponse('NOT_FOUND'),
    },
  });

function etagMatches(header: string | undefined, etag: string): boolean {
  if (!header) return false;
  const strip = (v: string) => v.trim().replace(/^W\//, '');
  return header.split(',').some((v) => v.trim() === '*' || strip(v) === strip(etag));
}

export function tripRoutes(sendEmail: SendEmail) {
  return new OpenAPIHono<AppBindings>({ defaultHook: validationHook })
    .openapi(createRouteDef, async (c) => {
      const { organiserEmail, ...input } = c.req.valid('json');
      const trip = await createTrip(
        c.var.db,
        {
          ...input,
          organiserEmailHash: organiserEmail
            ? await emailHash(c.env.EMAIL_HMAC_SECRET, organiserEmail)
            : null,
        },
        clientIp(c),
      );
      // F10: the address is used for this one email only and never stored (BR11).
      const emailSent = organiserEmail
        ? await sendOrganiserLink(c.env, sendEmail, organiserEmail, trip)
        : null;
      const view = await getTripView(c.var.db, trip, 'organiser', sessionIdOf(c));
      return c.json({ trip: view, access: accessFor('organiser', trip), emailSent }, 201);
    })
    .openapi(getRouteDef, async (c) => {
      const { trip, role } = c.var;
      const view = await getTripView(c.var.db, trip, role, sessionIdOf(c));
      const body = JSON.stringify({ trip: view, access: accessFor(role, trip) });
      const etag = `W/"${await shortHash(body)}"`;
      c.header('ETag', etag);
      if (etagMatches(c.req.header('If-None-Match'), etag)) {
        return c.body(null, 304);
      }
      return c.body(body, 200, { 'Content-Type': 'application/json; charset=utf-8' });
    })
    .openapi(patchRouteDef, async (c) => {
      const updated = await updateTrip(c.var.db, c.var.trip, c.req.valid('json'));
      const view = await getTripView(c.var.db, updated, 'organiser', sessionIdOf(c));
      return c.json({ trip: view, access: accessFor('organiser', updated) }, 200);
    })
    .openapi(deleteRouteDef, async (c) => {
      await deleteTrip(c.var.db, c.var.trip);
      return c.body(null, 204);
    })
    .openapi(publishRouteDef(true), async (c) => {
      return c.json({ status: await publish(c.var.db, c.var.trip, true) }, 200);
    })
    .openapi(publishRouteDef(false), async (c) => {
      return c.json({ status: await publish(c.var.db, c.var.trip, false) }, 200);
    });
}
