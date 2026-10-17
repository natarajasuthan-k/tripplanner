// Creates (if needed), migrates and seeds the E2E database before the run.
import { execSync } from 'node:child_process';
import path from 'node:path';
import postgres from 'postgres';
import { E2E_DATABASE_URL } from './playwright.config';

export default async function globalSetup() {
  const url = new URL(E2E_DATABASE_URL);
  const dbName = url.pathname.slice(1);
  const adminUrl = new URL(E2E_DATABASE_URL);
  adminUrl.pathname = '/postgres';

  const admin = postgres(adminUrl.toString(), { max: 1, onnotice: () => {} });
  try {
    const rows = await admin`select 1 from pg_database where datname = ${dbName}`;
    if (rows.length === 0) await admin.unsafe(`create database "${dbName}"`);
  } finally {
    await admin.end();
  }

  const pnpm = process.env.CI ? 'pnpm' : 'corepack pnpm';
  const root = path.resolve(import.meta.dirname, '..');
  const env = { ...process.env, DATABASE_URL: E2E_DATABASE_URL };
  execSync(`${pnpm} --filter @tripplanner/api db:migrate`, { cwd: root, env, stdio: 'inherit' });
  execSync(`${pnpm} --filter @tripplanner/api db:seed`, { cwd: root, env, stdio: 'inherit' });
}
