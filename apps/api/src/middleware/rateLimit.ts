import { createMiddleware } from 'hono/factory';
import type { AppBindings, Env } from '../env';
import { AppError } from '../lib/errors';
import { clientIp } from '../lib/http';

type RateLimitBinding = 'RL_READ' | 'RL_WRITE' | 'RL_PRESENCE' | 'RL_SEARCH';

export function rateLimited(retryAfterSeconds: number) {
  return new AppError('RATE_LIMITED', 'Too many requests — please wait a moment.', {
    retryAfterSeconds,
  });
}

/**
 * Per-IP, per-minute limit via a Workers Rate Limiting binding (backend-spec §8).
 * Skipped when the binding is absent (unit/integration tests).
 */
export function rateLimit(binding: RateLimitBinding) {
  return createMiddleware<AppBindings>(async (c, next) => {
    const limiter = (c.env as Env)[binding];
    if (limiter) {
      const { success } = await limiter.limit({ key: `${binding}:${clientIp(c)}` });
      if (!success) throw rateLimited(60);
    }
    await next();
  });
}
