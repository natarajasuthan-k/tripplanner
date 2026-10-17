// Emits Cloudflare's `_headers` file at build time (frontend-spec §6, §8); Workers static
// assets apply it to every response.
// The CSP allows the API origin from VITE_API_BASE_URL and pins the inline theme script by hash.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

const INLINE_SCRIPT = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;

export function apiOrigin(apiBaseUrl: string | undefined): string | null {
  if (!apiBaseUrl || apiBaseUrl.startsWith('/')) return null; // same origin
  return new URL(apiBaseUrl).origin;
}

export function buildCsp(html: string, apiBaseUrl: string | undefined): string {
  const hashes = [...html.matchAll(INLINE_SCRIPT)].map(
    ([, body]) =>
      `'sha256-${createHash('sha256')
        .update(body ?? '')
        .digest('base64')}'`,
  );
  const api = apiOrigin(apiBaseUrl);
  return [
    "default-src 'self'",
    `script-src 'self' ${hashes.join(' ')}`.trim(),
    // Radix's scroll lock injects a <style> element, so inline styles are allowed.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src 'self'${api ? ` ${api}` : ''}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

export function securityHeaders(apiBaseUrl: string | undefined): Plugin {
  let outDir = 'dist';
  return {
    name: 'tripplanner-security-headers',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    // Runs after index.html is written, so the inline-script hash matches the final file.
    closeBundle() {
      const html = readFileSync(path.join(outDir, 'index.html'), 'utf-8');
      const headers = [
        '/*',
        `  Content-Security-Policy: ${buildCsp(html, apiBaseUrl)}`,
        '  Referrer-Policy: no-referrer',
        '  X-Content-Type-Options: nosniff',
        '  X-Frame-Options: DENY',
        '  Permissions-Policy: camera=(), microphone=(), geolocation=()',
        '',
        '/assets/*',
        '  Cache-Control: public, max-age=31536000, immutable',
        '',
      ].join('\n');
      writeFileSync(path.join(outDir, '_headers'), headers);
    },
  };
}
