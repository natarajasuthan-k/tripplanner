import { OpenAPIHono } from '@hono/zod-openapi';
import { API_VERSION_PREFIX } from '@tripplanner/shared';
import { cors } from 'hono/cors';
import { createDb } from './db/client';
import type { AppBindings } from './env';
import { AppError } from './lib/errors';
import { validationHook } from './lib/validation';
import { dbMiddleware, defaultDbFactory, type DbFactory } from './middleware/db';
import { requestContext } from './middleware/requestContext';
import { securityHeaders } from './middleware/securityHeaders';
import { tripAccess } from './middleware/tripAccess';
import { dayRoutes } from './routes/days';
import { deleteRequestRoutes } from './routes/deleteRequests';
import { destinationRoutes } from './routes/destinations';
import { healthRoutes, type PingDb } from './routes/health';
import { tripRoutes } from './routes/trips';

export interface AppDeps {
  pingDb: PingDb;
  dbFactory: DbFactory;
  /** Outbound fetch for providers (tests inject a fake). */
  fetch: typeof fetch;
}

const defaultPingDb: PingDb = async (env) => {
  const { sql, close } = createDb(env.DATABASE_URL);
  try {
    await sql`select 1`;
  } finally {
    await close();
  }
};

export function createApp(deps: Partial<AppDeps> = {}) {
  const { pingDb = defaultPingDb, dbFactory = defaultDbFactory, fetch: fetchFn } = deps;

  const app = new OpenAPIHono<AppBindings>({ defaultHook: validationHook });

  app.use('*', requestContext);
  app.use('*', securityHeaders);
  app.use(
    '*',
    cors({
      origin: (origin, c) => (origin === c.env.CORS_ORIGIN ? origin : null),
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowHeaders: ['Content-Type', 'X-Session-Id', 'X-Request-Id', 'If-None-Match'],
      exposeHeaders: ['ETag', 'X-Request-Id', 'Retry-After'],
      maxAge: 600,
    }),
  );

  const api = new OpenAPIHono<AppBindings>({ defaultHook: validationHook });
  api.route('/', healthRoutes(pingDb));

  api.use('/destinations/*', dbMiddleware(dbFactory));
  api.use('/trips', dbMiddleware(dbFactory));
  api.use('/trips/*', dbMiddleware(dbFactory));
  // Resolve access codes before any route-level validation (404 precedes 400, api-contract §2).
  api.use('/trips/:token', tripAccess);
  api.use('/trips/:token/*', tripAccess);

  api.route('/', destinationRoutes(fetchFn));
  // Phase 2: `/trips/published` routes must be registered before `/trips/{token}`.
  api.route('/', tripRoutes());
  api.route('/', dayRoutes());
  api.route('/', deleteRequestRoutes());

  api.doc31('/openapi.json', {
    openapi: '3.1.0',
    info: { title: 'Trip Planner API', version: '1.0.0' },
  });

  app.route(API_VERSION_PREFIX, api);

  app.notFound((c) => c.json(new AppError('NOT_FOUND', 'Not found').toBody(), 404));

  app.onError((err, c) => {
    if (err instanceof AppError) {
      if (err.code === 'RATE_LIMITED') {
        const retry = (err.details as { retryAfterSeconds?: number } | null)?.retryAfterSeconds;
        if (retry) c.header('Retry-After', String(retry));
      }
      return c.json(err.toBody(), err.status as 400);
    }
    console.error(
      JSON.stringify({
        level: 'error',
        msg: 'unhandled',
        requestId: c.get('requestId'),
        route: c.req.routePath,
        error: err instanceof Error ? err.name : 'unknown',
      }),
    );
    return c.json(
      new AppError('INTERNAL_ERROR', 'Something went wrong. Please try again.').toBody(),
      500,
    );
  });

  return app;
}
