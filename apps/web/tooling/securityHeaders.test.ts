import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { apiOrigin, buildCsp } from './securityHeaders';

describe('buildCsp', () => {
  const inline = "(function(){document.documentElement.classList.add('dark')})();";
  const html = `<html><head><script>${inline}</script><script type="module" src="/assets/a.js"></script></head></html>`;

  it('hashes inline scripts only and allows the API origin', () => {
    const csp = buildCsp(html, 'https://tripplanner-api.example.workers.dev/api/v1');
    const hash = createHash('sha256').update(inline).digest('base64');
    expect(csp).toContain(`script-src 'self' 'sha256-${hash}'`);
    expect(csp).toContain("connect-src 'self' https://tripplanner-api.example.workers.dev");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
  });

  it('keeps connect-src same-origin for a relative API URL', () => {
    expect(apiOrigin('/api/v1')).toBeNull();
    expect(buildCsp(html, '/api/v1')).toContain("connect-src 'self';");
  });
});
