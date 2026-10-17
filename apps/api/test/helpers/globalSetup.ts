// Applies migrations to the test database once per run (needs `pnpm db:up`).
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import path from 'node:path';
import { TEST_DATABASE_URL } from './env';

export default async function setup() {
  const sql = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(sql), {
      migrationsFolder: path.resolve(import.meta.dirname, '../../src/db/migrations'),
    });
  } catch (err) {
    throw new Error(
      `Cannot prepare the test database at ${TEST_DATABASE_URL}. ` +
        `Start Postgres with \`pnpm db:up\` and create it once with ` +
        `\`docker compose exec db createdb -U trip tripplanner_test\`.`,
      { cause: err },
    );
  } finally {
    await sql.end();
  }
}
