import { TOKEN_PATTERN } from '@tripplanner/shared';
import { createMiddleware } from 'hono/factory';
import type { AppBindings } from '../env';
import { forbidden, notFound } from '../lib/errors';
import { findDayInTrip } from '../repositories/dayRepo';
import { findTripByToken, type TokenRole } from '../repositories/tripRepo';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolves the access code in `/trips/{token}/…` to a trip and role (backend-spec §5).
 * Unknown or malformed codes are always 404 — never 401 — so trip existence never leaks.
 */
export const tripAccess = createMiddleware<AppBindings>(async (c, next) => {
  const token = c.req.param('token');
  // `/trips/published…` shares the prefix but is public (api-contract §4 routing note).
  if (token === 'published') return next();
  if (c.get('trip')) return next(); // already resolved by an outer pattern

  if (!token || !TOKEN_PATTERN.test(token)) throw notFound('Trip not found');
  const found = await findTripByToken(c.var.db, token);
  if (!found) throw notFound('Trip not found');
  c.set('trip', found.trip);
  c.set('role', found.role);
  await next();
});

/** Route-level role gate (api-contract §4.1). Runs before body validation, so 403 precedes 400. */
export function requireRole(...roles: TokenRole[]) {
  return createMiddleware<AppBindings>(async (c, next) => {
    if (!roles.includes(c.var.role)) throw forbidden();
    await next();
  });
}

/** Resolves `{dayId}` within the current trip; a day from another trip is 404. */
export const tripDay = createMiddleware<AppBindings>(async (c, next) => {
  const dayId = c.req.param('dayId');
  if (!dayId || !UUID.test(dayId)) throw notFound('Day not found');
  const day = await findDayInTrip(c.var.db, c.var.trip.id, dayId);
  if (!day) throw notFound('Day not found');
  c.set('day', day);
  await next();
});
