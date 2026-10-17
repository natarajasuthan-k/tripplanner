import { createMiddleware } from 'hono/factory';
import type { AppBindings } from '../env';

/** Headers required on every response — api-contract §1, backend-spec §8. */
export const securityHeaders = createMiddleware<AppBindings>(async (c, next) => {
  await next();
  c.header('Referrer-Policy', 'no-referrer');
  c.header('X-Content-Type-Options', 'nosniff');
  if (!c.res.headers.has('Cache-Control')) {
    c.header('Cache-Control', 'no-store');
  }
});
