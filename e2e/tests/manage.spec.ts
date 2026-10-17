// AC7.1–7.3, AC8.1, AC10.2, AC11.1, AC12.4
import { expect, test } from '@playwright/test';
import { API, createTripViaApi, dayBox, isoDays, SEED, setDisplayName, showPlan } from './helpers';

test('a traveller asks for deletion and the organiser approves it', async ({
  page,
  browser,
  request,
}) => {
  const trip = await createTripViaApi(request);

  const tCtx = await browser.newContext();
  const traveller = await tCtx.newPage();
  await setDisplayName(traveller, 'Ravi');
  await traveller.goto(`/e/${trip.edit}`);
  await traveller.getByRole('button', { name: 'Request deletion' }).click();
  await traveller.getByRole('button', { name: 'Send request' }).click();
  await expect(traveller.getByText('Request sent to organiser', { exact: true })).toBeVisible();

  await page.goto(`/o/${trip.organiser}`);
  await expect(page.getByText(/Ravi.*asked to delete this trip/)).toBeVisible();
  await page.getByRole('button', { name: 'Approve (delete)' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete trip' }).click();
  await expect(page).toHaveURL('/');
  await expect(page.getByText('Trip deleted', { exact: true })).toBeVisible();

  await traveller.reload();
  await expect(traveller.getByRole('heading', { name: 'Trip not found' })).toBeVisible();
  await tCtx.close();
});

test('shortening the dates asks before removing days with plans', async ({ page, request }) => {
  const trip = await createTripViaApi(request);
  await request.put(`${API}/trips/${trip.edit}/days/${trip.dayIds[2]}`, {
    data: { text: 'Day three plans', version: 1, editorName: 'Seed' },
  });

  await page.goto(`/o/${trip.organiser}`);
  await page.getByRole('button', { name: 'Edit details' }).click();
  const edit = page.getByRole('dialog', { name: 'Edit trip details' });
  await edit.getByLabel('To', { exact: true }).fill(isoDays(14));
  await edit.getByRole('button', { name: 'Save changes' }).click();

  const confirm = page.getByRole('dialog', { name: 'Remove days with plans?' });
  await expect(confirm.getByText('Day three plans')).toBeVisible();
  await confirm.getByRole('button', { name: 'Remove days and save' }).click();
  await expect(page.getByText('Trip updated', { exact: true })).toBeVisible();
  await expect(page.getByText(/· 1 day$/)).toBeVisible();
});

test('a completed trip is read-only', async ({ page }) => {
  await page.goto(`/e/${SEED.completed.edit}`);
  await expect(page.getByText('This trip has ended and is now read-only.')).toBeVisible();
  await showPlan(page);
  await expect(page.getByText('Louvre in the morning')).toBeVisible();
  await expect(dayBox(page, 1)).toHaveCount(0);
});

test('forgot my link always shows the same confirmation', async ({ page }) => {
  await page.goto('/recover');
  await page.getByLabel('Email').fill('nobody@example.com');
  await page.getByRole('button', { name: 'Send my links' }).click();
  await expect(page.getByText(/If we have trips for this email/)).toBeVisible();
});
