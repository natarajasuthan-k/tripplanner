// Accessibility checks with axe-core on each page, in both themes — frontend-spec §8, §11.
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { SEED } from './helpers';

const PAGES = [
  ['home', '/'],
  ['create', '/new'],
  ['trip (organiser)', `/o/${SEED.published.organiser}`],
  ['explore', '/explore'],
  ['published trip', '/explore/kyoto-in-autumn'],
  ['how it works', '/how-it-works'],
  ['recover', '/recover'],
] as const;

for (const theme of ['light', 'dark'] as const) {
  for (const [label, path] of PAGES) {
    test(`${label} has no serious accessibility issues (${theme})`, async ({ page }) => {
      await page.addInitScript((t) => localStorage.setItem('tp.theme', t), theme);
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await page.waitForLoadState('networkidle');
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      const serious = results.violations.filter((v) =>
        ['serious', 'critical'].includes(v.impact ?? ''),
      );
      expect(
        serious.map(
          (v) =>
            `${v.id}: ${v.nodes
              .map((n) => n.target.join(' '))
              .slice(0, 3)
              .join(' | ')}`,
        ),
      ).toEqual([]);
    });
  }
}
