// AC1.1–1.7, AC2.1–2.3, AC2.8, AC9.1, AC12.3, AC13.1
import { expect, test } from '@playwright/test';
import { dayBox, isoDays, showPlan, unique } from './helpers';

test('organiser creates a trip, a traveller edits it, a viewer reads it', async ({
  page,
  browser,
}) => {
  const name = unique('Kyoto E2E');

  // --- Organiser creates the trip (with a recovery email) ---
  await page.goto('/new');
  await page.getByLabel('Trip name').fill(name);
  await page.getByLabel('Destination').fill('kyo');
  await page.getByRole('option', { name: /Kyoto/ }).click();
  await page.getByLabel('From', { exact: true }).fill(isoDays(10));
  await page.getByLabel('To', { exact: true }).fill(isoDays(12));
  await expect(page.getByText('3 days')).toBeVisible();
  await page.getByLabel(/Your email/).fill('organiser@example.com');
  await page.getByRole('button', { name: 'Create trip' }).click();

  const share = page.getByRole('dialog', { name: 'Your trip is ready!' });
  await expect(share).toBeVisible();
  await expect(
    share.getByText('We’ve emailed the organiser link to organiser@example.com.'),
  ).toBeVisible();
  const editUrl = await share.getByRole('textbox', { name: 'Edit link' }).inputValue();
  const viewUrl = await share.getByRole('textbox', { name: 'View-only link' }).inputValue();
  expect(editUrl).toMatch(/\/e\/[\w-]{43}$/);
  await share.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();

  // --- A traveller opens the edit link in a separate browser and edits Day 2 ---
  const traveller = await browser.newContext();
  const tPage = await traveller.newPage();
  await tPage.goto(editUrl);
  await showPlan(tPage);
  await dayBox(tPage, 2).click();
  const prompt = tPage.getByRole('dialog', { name: 'What should we call you?' });
  await prompt.getByLabel('Your name').fill('Asha');
  await prompt.getByRole('button', { name: 'Continue' }).click();
  await dayBox(tPage, 2).click();
  await tPage.keyboard.type('Nara deer park');
  await expect(tPage.getByText('Saved', { exact: true })).toBeVisible();

  // Editors can share the edit / view links but never see the organiser link.
  await tPage.getByRole('button', { name: 'Share' }).click();
  const tShare = tPage.getByRole('dialog', { name: 'Share this trip' });
  await expect(tShare.getByRole('textbox')).toHaveCount(2);
  await expect(tShare.getByText('Organiser link')).toHaveCount(0);

  // --- The organiser sees the edit without reloading (polling) ---
  await showPlan(page);
  await expect(dayBox(page, 2)).toHaveValue('Nara deer park', { timeout: 20_000 });
  await expect(page.getByText(/Last edited by Asha/)).toBeVisible();

  // --- A viewer sees the plan read-only ---
  const viewer = await browser.newContext();
  const vPage = await viewer.newPage();
  await vPage.goto(viewUrl);
  await showPlan(vPage);
  await expect(vPage.getByText('Nara deer park')).toBeVisible();
  await expect(vPage.getByRole('textbox')).toHaveCount(0);
  await expect(vPage.getByText('You’re viewing this trip read-only.')).toBeVisible();

  // --- The organiser's device remembers the trip ---
  await page.goto('/');
  await expect(
    page.getByRole('region', { name: 'Your trips on this device' }).getByText(name),
  ).toBeVisible();

  await traveller.close();
  await viewer.close();
});

test('invalid dates are rejected on the form', async ({ page }) => {
  await page.goto('/new');
  await page.getByLabel('From', { exact: true }).fill(isoDays(12));
  await page.getByLabel('To', { exact: true }).fill(isoDays(10));
  await page.getByLabel('To', { exact: true }).blur();
  await expect(page.getByText('To date must be on or after the from date')).toBeVisible();
});
