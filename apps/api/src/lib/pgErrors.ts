// Postgres error helpers. Drizzle wraps driver errors, so walk the `cause` chain.

interface PgErrorLike {
  code: string;
  constraint_name?: string;
}

function findPgError(err: unknown): PgErrorLike | null {
  let current: unknown = err;
  for (let depth = 0; current && depth < 5; depth++) {
    if (typeof current === 'object' && 'code' in current && typeof current.code === 'string') {
      return current as PgErrorLike;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return null;
}

/** True when `err` is a unique violation (23505), optionally on a specific constraint. */
export function isUniqueViolation(err: unknown, constraint?: string): boolean {
  const pg = findPgError(err);
  if (!pg || pg.code !== '23505') return false;
  return constraint === undefined || pg.constraint_name === constraint;
}
