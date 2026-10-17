// AC2.4, AC2.6 — two people editing the same trip.
import { expect, test } from '@playwright/test';
import { API, createTripViaApi, dayBox, setDisplayName, showPlan } from './helpers';

test('shows who is editing and resolves a conflicting save', async ({ browser, request }) => {
  const trip = await createTripViaApi(request);

  const aCtx = await browser.newContext();
  const bCtx = await browser.newContext();
  const a = await aCtx.newPage();
  const b = await bCtx.newPage();
  await setDisplayName(a, 'Asha');
  await setDisplayName(b, 'Ravi');
  await a.goto(`/e/${trip.edit}`);
  await b.goto(`/e/${trip.edit}`);
  await showPlan(a);
  await showPlan(b);

  // Presence: Asha focuses Day 1 → Ravi sees the indicator within a poll interval.
  await dayBox(a, 1).click();
  await expect(b.getByText('Asha is editing…')).toBeVisible({ timeout: 20_000 });

  // Conflict: Ravi types, but someone saves Day 1 before his autosave fires.
  await dayBox(b, 1).click();
  await b.keyboard.type('Ravi: ramen at Ichiran');
  const put = await request.put(`${API}/trips/${trip.edit}/days/${trip.dayIds[0]}`, {
    data: { text: 'Asha: temple walk', version: 1, editorName: 'Asha' },
  });
  expect(put.status()).toBe(200);

  const panel = b.getByRole('alert').filter({ hasText: 'saved a newer version' });
  await expect(panel).toBeVisible();
  await expect(panel.getByText('Asha: temple walk')).toBeVisible();
  await panel.getByRole('button', { name: 'Keep mine' }).click();
  await expect(panel).toHaveCount(0);
  await expect(b.getByText('Saved', { exact: true })).toBeVisible();

  const res = await request.get(`${API}/trips/${trip.edit}`);
  const body = (await res.json()) as { trip: { days: { text: string; version: number }[] } };
  expect(body.trip.days[0]).toMatchObject({ text: 'Ravi: ramen at Ichiran', version: 3 });

  await aCtx.close();
  await bCtx.close();
});
