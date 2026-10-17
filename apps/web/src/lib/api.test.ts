import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, ApiError } from './api';

afterEach(() => vi.unstubAllGlobals());

function stubFetch(response: Response | Error) {
  const fn = vi.fn(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('apiFetch', () => {
  it('sends X-Session-Id and JSON bodies', async () => {
    const fetchMock = stubFetch(Response.json({ ok: true }));
    await apiFetch('/trips', { method: 'POST', body: { a: 1 } });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(url).toBe('/api/v1/trips');
    expect(headers.get('X-Session-Id')).toMatch(/^[a-f0-9]{32}$/);
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(init.body).toBe('{"a":1}');
  });

  it('maps the standard error body to ApiError', async () => {
    stubFetch(
      Response.json(
        { error: { code: 'TRIP_NAME_TAKEN', message: 'Name taken', details: { field: 'name' } } },
        { status: 409 },
      ),
    );
    await expect(apiFetch('/trips')).rejects.toMatchObject({
      status: 409,
      code: 'TRIP_NAME_TAKEN',
      details: { field: 'name' },
    });
  });

  it('reports network failures as NETWORK_ERROR', async () => {
    stubFetch(new TypeError('Failed to fetch'));
    const err = await apiFetch('/health').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe('NETWORK_ERROR');
  });

  it('returns undefined for 204 responses', async () => {
    stubFetch(new Response(null, { status: 204 }));
    await expect(apiFetch('/trips/x', { method: 'DELETE' })).resolves.toBeUndefined();
  });
});
