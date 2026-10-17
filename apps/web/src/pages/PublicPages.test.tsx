import type { PublicTripResponse, TripSummary } from '@tripplanner/shared';
import { permissionsFor } from '@tripplanner/shared';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { buildDay, buildTripResponse } from '../test/builders';
import { apiError, installFakeApi, json } from '../test/fakeApi';
import { renderRoute } from '../test/renderRoute';

const destination = buildTripResponse('viewer').trip.destination;
const summary = (name: string, slug: string): TripSummary => ({
  name,
  slug,
  destination,
  fromDate: '2026-12-05',
  toDate: '2026-12-07',
  dayCount: 3,
  isCompleted: false,
  publishedAt: '2026-10-17T10:00:00.000Z',
});
const page = (items: TripSummary[], over: Partial<{ page: number; hasMore: boolean }> = {}) => ({
  items,
  page: 1,
  limit: 12,
  total: items.length,
  hasMore: false,
  ...over,
});

function publicTrip(slug: string, canonicalSlug = slug): PublicTripResponse {
  return {
    trip: {
      name: 'Kyoto Winter',
      slug,
      canonicalSlug,
      destination,
      fromDate: '2026-12-05',
      toDate: '2026-12-07',
      dayCount: 3,
      status: { isPublished: true, publishedAt: '2026-10-17T10:00:00.000Z', isCompleted: false },
      days: [buildDay(1, { text: 'Fushimi Inari at dawn' }), buildDay(2), buildDay(3)],
    },
    access: { role: 'public', permissions: permissionsFor('public', false) },
  };
}

const places = {
  items: [
    {
      id: 'p1',
      name: 'Fushimi Inari Taisha',
      category: 'tourism.sights',
      categoryLabel: 'Sight',
      description: 'Thousands of torii gates.',
      address: null,
      lat: 35,
      lon: 135,
      sourceUrl: null,
      wikipediaUrl: 'https://en.wikipedia.org/wiki/Fushimi_Inari-taisha',
    },
  ],
  stale: false,
  fetchedAt: '2026-10-17T10:00:00.000Z',
  attribution: 'Powered by Geoapify · © OpenStreetMap contributors',
};

describe('ExplorePage (F4, AC6.1)', () => {
  it('lists published trips, searches and loads more', async () => {
    const api = installFakeApi([
      [
        'GET',
        /^\/trips\/published$/,
        (req) => {
          if (req.search.get('q') === 'goa') return json(page([summary('Goa Beach', 'goa-beach')]));
          if (req.search.get('page') === '2')
            return json(page([summary('Paris', 'paris')], { page: 2 }));
          return json(page([summary('Kyoto Winter', 'kyoto-winter')], { hasMore: true }));
        },
      ],
    ]);
    renderRoute('/explore');
    expect(await screen.findByRole('link', { name: /Kyoto Winter/ })).toHaveAttribute(
      'href',
      '/explore/kyoto-winter',
    );

    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(await screen.findByRole('link', { name: /Paris/ })).toBeVisible();

    await userEvent.type(screen.getByLabelText('Search by destination or trip name'), 'goa');
    expect(await screen.findByRole('link', { name: /Goa Beach/ })).toBeVisible();
    expect(api.calls.some((c) => c.search.get('q') === 'goa')).toBe(true);
  });

  it('shows an empty state with a call to action', async () => {
    installFakeApi([['GET', /^\/trips\/published$/, () => json(page([]))]]);
    renderRoute('/explore');
    expect(await screen.findByText(/No published trips yet/)).toBeVisible();
  });
});

describe('PublishedTripPage (AC6.2, AC5.3, F12)', () => {
  function fake(response: PublicTripResponse | Response) {
    return installFakeApi([
      [
        'GET',
        /^\/trips\/published\/[^/]+$/,
        () => (response instanceof Response ? response : json(response)),
      ],
      ['GET', /^\/trips\/published$/, () => json(page([]))],
      ['GET', /^\/destinations\/[^/]+\/places$/, () => json(places)],
    ]);
  }

  it('shows the plan read-only with Copy this plan and place ideas', async () => {
    fake(publicTrip('kyoto-winter'));
    renderRoute('/explore/kyoto-winter');
    expect(await screen.findByRole('heading', { level: 1, name: 'Kyoto Winter' })).toBeVisible();
    expect(screen.getByText('Fushimi Inari at dawn')).toBeVisible();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByRole('link', { name: /Copy this plan/ })).toHaveAttribute(
      'href',
      '/new?from=kyoto-winter',
    );
    expect(await screen.findByText('Fushimi Inari Taisha')).toBeVisible();
    expect(screen.queryByRole('button', { name: /Add Fushimi/ })).toBeNull(); // read-only
    expect(screen.getByText(/OpenStreetMap/)).toBeVisible();
  });

  it('redirects an old slug to the canonical one (AC5.3)', async () => {
    fake(publicTrip('kyoto-old', 'kyoto-winter'));
    const { router } = renderRoute('/explore/kyoto-old');
    await waitFor(() => expect(router.state.location.pathname).toBe('/explore/kyoto-winter'));
  });

  it('shows Trip not found for private or unknown trips', async () => {
    fake(apiError(404, 'NOT_FOUND'));
    renderRoute('/explore/nope');
    expect(await screen.findByRole('heading', { name: 'Trip not found' })).toBeVisible();
  });
});

describe('RecoverPage (F10, AC12.4–12.5)', () => {
  it('always shows the same confirmation', async () => {
    const api = installFakeApi([['POST', /^\/recover$/, () => json({ message: 'ignored' }, 202)]]);
    renderRoute('/recover');
    await userEvent.type(await screen.findByLabelText('Email'), 'me@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send my links' }));
    expect(await screen.findByText(/If we have trips for this email/)).toBeVisible();
    expect(api.calls[0]!.body).toEqual({ email: 'me@example.com' });
  });

  it('validates the email and reports rate limits', async () => {
    installFakeApi([['POST', /^\/recover$/, () => apiError(429, 'RATE_LIMITED')]]);
    renderRoute('/recover');
    await userEvent.type(await screen.findByLabelText('Email'), 'nope');
    await userEvent.click(screen.getByRole('button', { name: 'Send my links' }));
    expect(await screen.findByText('Please enter a valid email address')).toBeVisible();

    await userEvent.clear(screen.getByLabelText('Email'));
    await userEvent.type(screen.getByLabelText('Email'), 'me@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send my links' }));
    expect(await screen.findByText('Please wait before trying again.')).toBeVisible();
  });
});

describe('HomePage — recently published (F4)', () => {
  it('shows up to six published trips', async () => {
    installFakeApi([
      ['GET', /^\/trips\/published$/, () => json(page([summary('Kyoto Winter', 'kyoto-winter')]))],
    ]);
    renderRoute('/');
    expect(await screen.findByRole('heading', { name: 'Recently published' })).toBeVisible();
    expect(screen.getByRole('link', { name: /Kyoto Winter/ })).toBeVisible();
  });
});
