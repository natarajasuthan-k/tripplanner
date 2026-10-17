import { focusManager } from '@tanstack/react-query';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { buildTripResponse, TOKENS } from '../test/builders';
import { apiError, installFakeApi, json } from '../test/fakeApi';
import { renderRoute } from '../test/renderRoute';

type Role = 'organiser' | 'editor' | 'viewer';
const prefix: Record<Role, string> = { organiser: 'o', editor: 'e', viewer: 'v' };

function openTrip(role: Role, response = buildTripResponse(role), query = '') {
  const api = installFakeApi([
    ['GET', /^\/trips\/[^/]+$/, () => json(response)],
    ['POST', /\/delete-requests\/dismiss$/, () => json({ dismissedCount: 2 })],
    [
      'POST',
      /\/delete-requests$/,
      (req) =>
        json(
          {
            deleteRequest: {
              id: 'r1',
              requestedByName: (req.body as { requestedByName: string }).requestedByName,
              createdAt: '2026-10-17T10:00:00.000Z',
            },
          },
          201,
        ),
    ],
  ]);
  const view = renderRoute(`/${prefix[role]}/${TOKENS[role]}${query}`);
  return { ...view, api };
}

describe('TripPage — role-driven UI (frontend-spec §6 permission matrix)', () => {
  it('organiser: share + delete, no request-deletion', async () => {
    openTrip('organiser');
    expect(await screen.findByRole('heading', { level: 1, name: 'Kyoto Winter' })).toBeVisible();
    expect(screen.getByRole('button', { name: /share/i })).toBeVisible();
    expect(screen.getByRole('button', { name: /delete trip/i })).toBeVisible();
    expect(screen.queryByRole('button', { name: /request deletion/i })).toBeNull();
    expect(screen.getAllByRole('textbox')).toHaveLength(3);
    expect(screen.getByText('Private')).toBeVisible();
  });

  it('editor: share + request deletion, no delete', async () => {
    openTrip('editor');
    await screen.findByRole('heading', { level: 1, name: 'Kyoto Winter' });
    expect(screen.getByRole('button', { name: /share/i })).toBeVisible();
    expect(screen.getByRole('button', { name: /request deletion/i })).toBeVisible();
    expect(screen.queryByRole('button', { name: /delete trip/i })).toBeNull();
  });

  it('viewer: read-only, no actions (AC9.1)', async () => {
    openTrip('viewer');
    await screen.findByRole('heading', { level: 1, name: 'Kyoto Winter' });
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: /share|delete/i })).toBeNull();
    expect(screen.getByText('You’re viewing this trip read-only.')).toBeVisible();
    expect(screen.getAllByText('Nothing planned yet.')).toHaveLength(3);
  });

  it('Completed trip: read-only for everyone, organiser can still delete (AC11.1–11.2)', async () => {
    openTrip(
      'organiser',
      buildTripResponse('organiser', {
        status: { isPublished: false, publishedAt: null, isCompleted: true },
      }),
    );
    await screen.findByText('This trip has ended and is now read-only.');
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByRole('button', { name: /delete trip/i })).toBeVisible();
  });
});

describe('TripPage — share links', () => {
  it('opens automatically after creation with all three links (AC1.1)', async () => {
    openTrip('organiser', buildTripResponse('organiser'), '?created=1');
    const dialog = await screen.findByRole('dialog', { name: 'Your trip is ready!' });
    const inputs = within(dialog).getAllByRole('textbox');
    expect(inputs.map((i) => (i as HTMLInputElement).value)).toEqual([
      `${location.origin}/e/${TOKENS.editor}`,
      `${location.origin}/v/${TOKENS.viewer}`,
      `${location.origin}/o/${TOKENS.organiser}`,
    ]);
  });

  it('never shows the organiser link to editors (AC2.8)', async () => {
    openTrip('editor');
    await userEvent.click(await screen.findByRole('button', { name: /share/i }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getAllByRole('textbox')).toHaveLength(2);
    expect(within(dialog).queryByText(/organiser link/i)).toBeNull();
  });
});

describe('TripPage — editing', () => {
  it('asks for a display name before the first edit (AC2.2)', async () => {
    openTrip('editor');
    const [first] = await screen.findAllByRole('textbox');
    await userEvent.click(first!);
    const dialog = await screen.findByRole('dialog', { name: 'What should we call you?' });
    await userEvent.type(within(dialog).getByLabelText('Your name'), 'Asha');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(localStorage.getItem('tp.displayName')).toBe('Asha'));
  });

  it('shows who is editing a day (AC2.6)', async () => {
    const response = buildTripResponse('editor');
    response.trip.days[0]!.editors = [
      { displayName: 'Ravi', lastSeenAt: '2026-10-17T10:00:00.000Z' },
    ];
    openTrip('editor', response);
    expect(await screen.findByText('Ravi is editing…')).toBeVisible();
  });

  it('shows last-edited info (AC2.3)', async () => {
    const response = buildTripResponse('viewer');
    response.trip.days[1] = {
      ...response.trip.days[1]!,
      text: 'Nara deer park',
      updatedByName: 'Asha',
      updatedAt: '2026-10-17T09:30:00.000Z',
    };
    openTrip('viewer', response);
    expect(await screen.findByText('Nara deer park')).toBeVisible();
    expect(screen.getByText(/Last edited by Asha/)).toBeVisible();
  });
});

describe('TripPage — delete requests', () => {
  it('organiser sees all requests and can dismiss them (AC7.2–7.3)', async () => {
    const response = buildTripResponse('organiser', {
      pendingDeleteRequests: [
        { id: 'r2', requestedByName: 'Asha', createdAt: '2026-10-17T10:00:00.000Z' },
        { id: 'r1', requestedByName: 'Ravi', createdAt: '2026-10-16T10:00:00.000Z' },
      ],
    });
    const { api } = openTrip('organiser', response);
    expect(await screen.findByText(/and 1 other asked to delete this trip/)).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss all' }));
    await waitFor(() =>
      expect(api.calls.some((c) => c.path.endsWith('/delete-requests/dismiss'))).toBe(true),
    );
  });

  it('editor can request deletion (AC8.1)', async () => {
    const { api } = openTrip('editor');
    await userEvent.click(await screen.findByRole('button', { name: /request deletion/i }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Your name'), 'Ravi');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send request' }));
    expect(await screen.findByText('Request sent to organiser')).toBeVisible();
    const call = api.calls.find((c) => c.method === 'POST');
    expect(call?.body).toEqual({ requestedByName: 'Ravi' });
  });
});

describe('TripPage — deleted while open', () => {
  it('switches to Trip not found when a refetch returns 404 (AC7.1)', async () => {
    let deleted = false;
    installFakeApi([
      [
        'GET',
        /^\/trips\/[^/]+$/,
        () =>
          deleted
            ? apiError(404, 'NOT_FOUND', 'Trip not found')
            : json(buildTripResponse('editor')),
      ],
    ]);
    renderRoute(`/e/${TOKENS.editor}`);
    await screen.findByRole('heading', { level: 1, name: 'Kyoto Winter' });

    deleted = true;
    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true); // triggers refetchOnWindowFocus
    });
    expect(await screen.findByRole('heading', { name: 'Trip not found' })).toBeVisible();
    expect(
      screen.getByRole('button', { name: /Remove “Kyoto Winter” from my trips/ }),
    ).toBeVisible();
  });
});

describe('TripPage — device memory (F11)', () => {
  it('remembers the trip and role on this device (AC13.1)', async () => {
    openTrip('editor');
    await screen.findByRole('heading', { level: 1, name: 'Kyoto Winter' });
    const saved = JSON.parse(localStorage.getItem('tp.myTrips') ?? '[]') as {
      name: string;
      role: string;
      token: string;
    }[];
    expect(saved[0]).toMatchObject({ name: 'Kyoto Winter', role: 'editor', token: TOKENS.editor });
  });
});
