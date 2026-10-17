import { addDays, todayAoE } from '@tripplanner/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { buildTripResponse, TOKENS } from '../test/builders';
import { apiError, installFakeApi, json } from '../test/fakeApi';
import { renderRoute } from '../test/renderRoute';

const kyoto = buildTripResponse('organiser').trip.destination;
const from = addDays(todayAoE(), 30);
const to = addDays(todayAoE(), 32);

function fakeApi(onCreate: (body: unknown) => Response) {
  return installFakeApi([
    ['GET', /^\/destinations\/search/, () => json({ items: [kyoto] })],
    ['POST', /^\/trips$/, (req) => onCreate(req.body)],
    ['GET', /^\/trips\/[^/]+$/, () => json(buildTripResponse('organiser'))],
  ]);
}

async function fillForm(name = 'Kyoto Winter') {
  await userEvent.type(await screen.findByLabelText('Trip name'), name);
  await userEvent.type(screen.getByLabelText('Destination'), 'kyo');
  await userEvent.click(await screen.findByRole('option', { name: /Kyoto/ }));
  fireEvent.change(screen.getByLabelText('From'), { target: { value: from } });
  fireEvent.change(screen.getByLabelText('To'), { target: { value: to } });
}

describe('CreateTripPage (F1)', () => {
  it('validates required fields on submit (AC1.6)', async () => {
    renderRoute('/new');
    await userEvent.click(await screen.findByRole('button', { name: 'Create trip' }));
    expect(await screen.findByText(/at least 3 characters/)).toBeVisible();
    expect(screen.getByText('Please choose a destination from the list')).toBeVisible();
    expect(screen.getByText('Please choose a start date')).toBeVisible();
    expect(screen.getByLabelText('Trip name')).toHaveFocus();
  });

  it('rejects a To date before the From date (AC1.3)', async () => {
    renderRoute('/new');
    fireEvent.change(await screen.findByLabelText('From'), { target: { value: to } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: from } });
    fireEvent.blur(screen.getByLabelText('To'));
    expect(await screen.findByText('To date must be on or after the from date')).toBeVisible();
  });

  it('creates the trip, remembers it and opens the share dialog (AC1.1)', async () => {
    let posted: unknown;
    fakeApi((body) => {
      posted = body;
      return json({ ...buildTripResponse('organiser'), emailSent: null }, 201);
    });
    const { router } = renderRoute('/new');
    await fillForm();
    expect(screen.getByText('3 days')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Create trip' }));

    expect(await screen.findByRole('dialog', { name: 'Your trip is ready!' })).toBeVisible();
    expect(posted).toEqual({
      name: 'Kyoto Winter',
      destinationId: kyoto.id,
      fromDate: from,
      toDate: to,
    });
    expect(router.state.location.pathname).toBe(`/o/${TOKENS.organiser}`);
    expect(localStorage.getItem('tp.myTrips')).toContain(TOKENS.organiser);
  });

  it('shows a taken name under the name field (AC1.5)', async () => {
    fakeApi(() =>
      apiError(409, 'TRIP_NAME_TAKEN', 'That trip name is already taken.', { field: 'name' }),
    );
    renderRoute('/new');
    await fillForm();
    await userEvent.click(screen.getByRole('button', { name: 'Create trip' }));
    expect(await screen.findByText('That trip name is already taken.')).toBeVisible();
    await waitFor(() => expect(screen.getByLabelText('Trip name')).toHaveFocus());
  });
});
