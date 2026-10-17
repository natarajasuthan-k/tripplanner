// AC4.1, AC5.1–5.2, AC6.1–6.2, AC14.1–14.3, AC3.1–3.2
import { expect, test } from '@playwright/test';
import {
  createTripViaApi,
  dayBox,
  isoDays,
  setDisplayName,
  showIdeas,
  showPlan,
  unique,
} from './helpers';

test('organiser publishes; visitors find it, read it and copy it', async ({
  page,
  browser,
  request,
}) => {
  const name = unique('Publish E2E');
  const trip = await createTripViaApi(request, { name });

  await setDisplayName(page, 'Organiser');
  await page.goto(`/o/${trip.organiser}`);
  await page.getByRole('button', { name: 'Publish' }).click();
  await page
    .getByRole('dialog', { name: 'Publish this trip?' })
    .getByRole('button', { name: 'Publish' })
    .click();
  await expect(page.getByText('Published', { exact: true })).toBeVisible();

  // A visitor (no links) finds it in Explore.
  const visitorCtx = await browser.newContext();
  const visitor = await visitorCtx.newPage();
  await visitor.goto('/explore');
  await visitor.getByLabel('Search by destination or trip name').fill(name.split(' ').pop()!);
  await visitor.getByRole('link', { name: new RegExp(name) }).click();
  await expect(visitor.getByRole('heading', { level: 1, name })).toBeVisible();
  await expect(visitor.getByRole('textbox')).toHaveCount(0);
  expect(await visitor.content()).not.toContain(trip.edit);

  // …and copies it with fewer days.
  await visitor.getByRole('link', { name: 'Copy this plan' }).click();
  await expect(visitor.getByText(new RegExp(`Copying the plan from “${name}”`))).toBeVisible();
  await visitor.getByLabel('Trip name').fill(unique('Copy E2E'));
  await visitor.getByLabel('From', { exact: true }).fill(isoDays(40));
  await visitor.getByLabel('To', { exact: true }).fill(isoDays(40));
  await expect(visitor.getByText('2 days from the original won’t be copied.')).toBeVisible();
  await visitor.getByRole('button', { name: 'Create trip' }).click();
  await expect(visitor.getByRole('dialog', { name: 'Your trip is ready!' })).toBeVisible();
  await expect(visitor.getByText('Private', { exact: true })).toBeVisible();

  // Un-publishing removes it from Explore.
  await page.getByRole('button', { name: 'Un-publish' }).click();
  await expect(page.getByText('Private', { exact: true })).toBeVisible();
  await visitor.goto(`/explore/${trip.slug}`);
  await expect(visitor.getByRole('heading', { name: 'Trip not found' })).toBeVisible();
  await visitorCtx.close();
});

test('places from the Ideas panel can be added to a day', async ({ page, request }) => {
  const trip = await createTripViaApi(request);
  await setDisplayName(page, 'Asha');
  await page.goto(`/e/${trip.edit}`);

  await showIdeas(page);
  await page.getByRole('button', { name: 'Add Fushimi Inari Taisha to plan' }).click();
  await page.getByRole('button', { name: /^Day 2/ }).click();
  await expect(page.getByText('Added to Day 2', { exact: true })).toBeVisible();

  await showPlan(page);
  await expect(dayBox(page, 2)).toHaveValue('• Fushimi Inari Taisha (Sight)');
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
});

test('earlier published trips to the destination are listed', async ({ page }) => {
  await page.goto('/new');
  await page.getByLabel('Destination').fill('kyo');
  await page.getByRole('option', { name: /Kyoto/ }).click();
  const viewport = page.viewportSize();
  test.skip(
    !!viewport && viewport.width < 1024,
    'Earlier trips sit beside the form on desktop only',
  );
  await expect(page.getByRole('heading', { name: 'Earlier trips to Kyoto' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Kyoto in Autumn/ })).toBeVisible();
});
