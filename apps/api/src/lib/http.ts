import type { Context } from 'hono';

/** Client IP for rate limiting (Cloudflare sets CF-Connecting-IP). */
export function clientIp(c: Context): string {
  return (
    c.req.header('CF-Connecting-IP') ??
    c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ??
    'local'
  );
}

/** Per-tab session id (api-contract §1), or null if absent/invalid. */
export function sessionIdOf(c: Context): string | null {
  const id = c.req.header('X-Session-Id');
  return id && id.length >= 8 && id.length <= 64 ? id : null;
}
