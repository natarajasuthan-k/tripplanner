import { createMiddleware } from 'hono/factory';
import type { AppBindings } from '../env';

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 } as const;
const REQUEST_ID = /^[A-Za-z0-9._-]{1,64}$/;

/**
 * Request ID + structured access log (backend-spec §7).
 * Logs the ROUTE PATTERN (e.g. /api/v1/trips/:token), never the raw path, so access codes never
 * reach the logs. Bodies, emails and day text are never logged.
 */
export const requestContext = createMiddleware<AppBindings>(async (c, next) => {
  const incoming = c.req.header('X-Request-Id');
  const requestId = incoming && REQUEST_ID.test(incoming) ? incoming : crypto.randomUUID();
  c.set('requestId', requestId);

  const start = Date.now();
  await next();
  c.header('X-Request-Id', requestId);

  const level = c.env?.LOG_LEVEL ?? 'info';
  if (LEVELS[level] <= LEVELS.info) {
    console.log(
      JSON.stringify({
        level: 'info',
        msg: 'request',
        requestId,
        method: c.req.method,
        route: c.req.routePath,
        status: c.res.status,
        durationMs: Date.now() - start,
      }),
    );
  }
});
