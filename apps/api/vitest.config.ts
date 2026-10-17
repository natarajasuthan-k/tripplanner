import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    globalSetup: ['test/helpers/globalSetup.ts'],
    // Integration tests share one Postgres database and truncate between tests.
    fileParallelism: false,
  },
});
