// Minimal in-test API: route (method, path regex) → handler. Unmatched requests fail loudly.
import { vi } from 'vitest';

export interface FakeRequest {
  method: string;
  /** Path without /api/v1 and without the query string (routes match against this). */
  path: string;
  search: URLSearchParams;
  body: unknown;
  headers: Headers;
  match: RegExpMatchArray;
}

type Handler = (req: FakeRequest) => Response | Promise<Response>;

export function installFakeApi(routes: [method: string, path: RegExp, handler: Handler][]) {
  const calls: FakeRequest[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input), 'http://localhost');
    const path = url.pathname.replace(/^\/api\/v1/, '');
    const method = (init.method ?? 'GET').toUpperCase();
    const body = typeof init.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined;
    for (const [m, re, handler] of routes) {
      const match = path.match(re);
      if (m === method && match) {
        const req = {
          method,
          path,
          search: url.searchParams,
          body,
          headers: new Headers(init.headers),
          match,
        };
        calls.push(req);
        return handler(req);
      }
    }
    throw new Error(`fakeApi: unhandled ${method} ${path}${url.search}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return { calls, fetchMock };
}

export const json = (body: unknown, status = 200) => Response.json(body, { status });

export const apiError = (status: number, code: string, message = code, details: unknown = null) =>
  Response.json({ error: { code, message, details } }, { status });
