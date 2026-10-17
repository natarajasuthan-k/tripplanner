/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { securityHeaders } from './tooling/securityHeaders';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    plugins: [react(), tailwindcss(), securityHeaders(env.VITE_API_BASE_URL)],
    server: {
      port: 5173,
      // Local API (wrangler dev) — lets VITE_API_BASE_URL default to the relative /api/v1.
      proxy: { '/api': 'http://127.0.0.1:8787' },
    },
    build: {
      target: 'es2022',
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}', 'tooling/**/*.test.ts'],
      // The first test in each file compiles lazy route chunks, which can take several seconds.
      testTimeout: 60_000,
    },
  };
});
