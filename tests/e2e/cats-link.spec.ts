import { expect, test } from '@playwright/test';
import { DEMO_USER } from './demo-user';

// The dashboard's "Meet the cats" link leads out of the dashboard's layout to
// /cats, where cats come only when summoned: the dashboard's cats stop coming
// there, and start again on the way back. Links are followed by keyboard, which
// the cats never touch, so no cat on the page can get in the way.
test.skip(!process.env.E2E_POSTGRES_URL, 'needs a database (POSTGRES_URL)');
test.use({ storageState: DEMO_USER });

// Several page changes per test, each allowed 15 s under a busy next dev: more
// than the default 30 s in all.
test.describe.configure({ timeout: 60_000 });

test('cats stop coming on /cats and start again back on the dashboard', async ({ page }) => {
  // Chaos (a first cat within 3 s) keeps the waits short, and they are in page time,
  // on a fake clock the test moves on (clock.runFor) rather than waits through.
  // Before the first page, so the dashboard runs at chaos from its first render.
  await page.clock.install();
  await page.addInitScript(() => localStorage.setItem('xenocats:intensity', 'chaos'));
  await page.goto('/dashboard');
  await expect(page.getByTestId('xenocat-page')).toHaveAttribute('data-cat-intensity', 'chaos');

  await page.getByRole('link', { name: 'Meet the cats' }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/cats$/, { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: 'The cats' })).toBeVisible();
  // Summoned cats only: no intensity, no cat left over from the dashboard, and none
  // arriving in longer than chaos ever takes to bring one.
  await expect(page.getByTestId('xenocat-page')).not.toHaveAttribute('data-cat-intensity');
  await expect(page.getByTestId('xenocat')).toHaveCount(0);
  await page.clock.runFor(4_000);
  await expect(page.getByTestId('xenocat')).toHaveCount(0);

  await page.getByRole('link', { name: 'Back to the dashboard' }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
  await expect(page.getByTestId('xenocat-page')).toHaveAttribute('data-cat-intensity', 'chaos');
  await expect
    .poll(async () => {
      await page.clock.runFor(500);
      return page.getByTestId('xenocat').count();
    })
    .toBeGreaterThanOrEqual(1);
});
