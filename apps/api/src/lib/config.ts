// Startup configuration check — backend-spec §9. Production refuses to serve with unsafe or
// missing settings (e.g. fake providers, a short HMAC secret, non-HTTPS origins).
import type { Env } from '../env';

const PLACEHOLDER = /^(|replace-me.*|test|changeme)$/i;

function isUrl(value: string | undefined, requireHttps: boolean): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return requireHttps ? url.protocol === 'https:' : /^https?:$/.test(url.protocol);
  } catch {
    return false;
  }
}

/** Returns the names of problems (never the values), empty when the config is usable. */
export function configProblems(env: Env): string[] {
  const production = env.ENVIRONMENT === 'production';
  const problems: string[] = [];

  if (!env.DATABASE_URL) problems.push('DATABASE_URL is missing');
  if (!env.EMAIL_HMAC_SECRET || env.EMAIL_HMAC_SECRET.length < 32) {
    problems.push('EMAIL_HMAC_SECRET must be at least 32 characters');
  }
  if (!isUrl(env.APP_PUBLIC_URL, production)) problems.push('APP_PUBLIC_URL is not a valid URL');
  if (!isUrl(env.CORS_ORIGIN, production)) problems.push('CORS_ORIGIN is not a valid URL');

  if (env.PROVIDER_MODE === 'live' && PLACEHOLDER.test(env.GEOAPIFY_API_KEY ?? '')) {
    problems.push('GEOAPIFY_API_KEY is missing');
  }
  if (env.EMAIL_MODE === 'live') {
    if (PLACEHOLDER.test(env.RESEND_API_KEY ?? '')) problems.push('RESEND_API_KEY is missing');
    if (!env.EMAIL_FROM) problems.push('EMAIL_FROM is missing');
  }

  if (production) {
    if (env.PROVIDER_MODE !== 'live') problems.push('PROVIDER_MODE must be "live" in production');
    if (env.EMAIL_MODE !== 'live') problems.push('EMAIL_MODE must be "live" in production');
    if (
      PLACEHOLDER.test(env.EMAIL_HMAC_SECRET ?? '') ||
      /replace-me/i.test(env.EMAIL_HMAC_SECRET ?? '')
    ) {
      problems.push('EMAIL_HMAC_SECRET is a placeholder');
    }
  }
  return problems;
}

let checked: { env: Env; problems: string[] } | null = null;

/** Memoised per isolate (env is stable for a Worker isolate). Logs problems once. */
export function cachedConfigProblems(env: Env): string[] {
  if (checked?.env === env) return checked.problems;
  const problems = configProblems(env);
  if (problems.length > 0) {
    console.error(JSON.stringify({ level: 'error', msg: 'configuration problems', problems }));
  }
  checked = { env, problems };
  return problems;
}
