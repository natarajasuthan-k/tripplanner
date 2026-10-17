import { addDays, todayAoE, type TripResponse } from '@tripplanner/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { buildDay, buildTripResponse, TOKENS } from '../test/builders';
import { apiError, installFakeApi, json, type FakeRequest } from '../test/fakeApi';
import { renderRoute } from '../test/renderRoute';

const emptyPage = { items: [], page: 1, limit: 10, total: 0, hasMore: false };
const places = {
  items: [
    {
      id: 'p1',
      name: 'Gion',
      category: 'tourism.attraction',
      categoryLabel: 'Attraction',
      description: null,
      address: null,
      lat: 35,
      lon: 135,
      sourceUrl: null,
      wikipediaUrl: null,
    },
  ],
  stale: false,
  fetchedAt: '2026-10-17T10:00:00.000Z',
  attribution: 'Powered by Geoapify · © OpenStreetMap contributors',
};

function openOrganiser(
  response: TripResponse,
  extra: [string, RegExp, (req: FakeRequest) => Response][] = [],
) {
  const api = installFakeApi([
    ...extra,
    ['GET', /^\/trips\/published$/, () => json(emptyPage)],
    ['GET', /^\/destinations\/[^/]+\/places$/, () => json(places)],
    ['GET', /^\/trips\/[^/]+$/, () => json(response)],
  ]);
  renderRoute(`/o/${TOKENS.organiser}`);
  return api;
}

describe('TripPage — publish (F4, AC5.1–5.2)', () => {
  it('asks before publishing, then shows Published', async () => {
    const api = openOrganiser(buildTripResponse('organiser'), [
      [
        'POST',
        /\/publish$/,
        () =>
          json({
            status: {
              isPublished: true,
              publishedAt: '2026-10-17T10:00:00.000Z',
              isCompleted: false,
            },
          }),
      ],
    ]);
    await userEvent.click(await screen.findByRole('button', { name: 'Publish' }));
    const dialog = await screen.findByRole('dialog', { name: 'Publish this trip?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Publish' }));
    expect(await screen.findByText('Published')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Un-publish' })).toBeVisible();
    expect(api.calls.some((c) => c.path.endsWith('/publish'))).toBe(true);
  });

  it('editors cannot publish or edit details', async () => {
    installFakeApi([
      ['GET', /^\/trips\/published$/, () => json(emptyPage)],
      ['GET', /^\/destinations\/[^/]+\/places$/, () => json(places)],
      ['GET', /^\/trips\/[^/]+$/, () => json(buildTripResponse('editor'))],
    ]);
    renderRoute(`/e/${TOKENS.editor}`);
    await screen.findByRole('heading', { level: 1, name: 'Kyoto Winter' });
    expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit details' })).toBeNull();
  });
});

describe('TripPage — edit details (F8, AC10.1–10.2)', () => {
  it('confirms before removing days with plans, then resends with confirmation', async () => {
    const from = addDays(todayAoE(), 10);
    const response = buildTripResponse('organiser', {
      fromDate: from,
      toDate: addDays(from, 2),
      days: [buildDay(1), buildDay(2), buildDay(3, { text: 'Nara day trip' })],
    });
    const patches: unknown[] = [];
    openOrganiser(response, [
      [
        'PATCH',
        /^\/trips\/[^/]+$/,
        (req) => {
          patches.push(req.body);
          if (!(req.body as { confirmRemoveDays?: boolean }).confirmRemoveDays) {
            return apiError(409, 'DAYS_WOULD_BE_REMOVED', '1 day with plans would be removed.', {
              removedDays: [{ position: 3, date: addDays(from, 2), textPreview: 'Nara day trip' }],
            });
          }
          return json(
            buildTripResponse('organiser', { fromDate: from, toDate: from, days: [buildDay(1)] }),
          );
        },
      ],
    ]);

    await userEvent.click(await screen.findByRole('button', { name: 'Edit details' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit trip details' });
    fireEvent.change(within(dialog).getByLabelText('To'), { target: { value: from } });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    const confirm = await screen.findByRole('dialog', { name: 'Remove days with plans?' });
    expect(within(confirm).getByText('Nara day trip')).toBeVisible();
    await userEvent.click(within(confirm).getByRole('button', { name: 'Remove days and save' }));

    await waitFor(() => expect(patches).toHaveLength(2));
    expect(patches[0]).toEqual({ version: 1, toDate: from });
    expect(patches[1]).toEqual({ version: 1, toDate: from, confirmRemoveDays: true });
    expect(await screen.findByText('Trip updated')).toBeVisible();
  });
});

describe('TripPage — places & add to plan (F5, AC3.1–3.2)', () => {
  it('adds a place to the chosen day through autosave', async () => {
    localStorage.setItem('tp.displayName', 'Asha');
    const saves: unknown[] = [];
    openOrganiser(buildTripResponse('organiser'), [
      [
        'PUT',
        /\/days\/[^/]+$/,
        (req) => {
          saves.push(req.body);
          return json({
            day: buildDay(2, { text: (req.body as { text: string }).text, version: 2 }),
          });
        },
      ],
    ]);
    const add = await screen.findByRole('button', { name: 'Add Gion to plan' });
    await userEvent.click(add);
    await userEvent.click(await screen.findByRole('button', { name: /Day 2/ }));
    await waitFor(() =>
      expect(saves).toEqual([{ text: '• Gion (Attraction)', version: 1, editorName: 'Asha' }]),
    );
    expect(await screen.findByText('Added to Day 2')).toBeVisible();
  });

  it('shows "Suggestions unavailable" without breaking the page (AC3.3)', async () => {
    installFakeApi([
      ['GET', /^\/trips\/published$/, () => json(emptyPage)],
      ['GET', /^\/destinations\/[^/]+\/places$/, () => apiError(503, 'PROVIDER_UNAVAILABLE')],
      ['GET', /^\/trips\/[^/]+$/, () => json(buildTripResponse('organiser'))],
    ]);
    renderRoute(`/o/${TOKENS.organiser}`);
    expect(await screen.findByText('Suggestions unavailable right now.')).toBeVisible();
    expect(screen.getAllByRole('textbox')).toHaveLength(3);
  });
});
