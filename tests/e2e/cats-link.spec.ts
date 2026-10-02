import { expect, test } from '@playwright/test';

// The dashboard's "Meet the cats" link leads out of the dashboard's layout to
// /cats, where cats come only when summoned: the dashboard's cats stop coming
// there, and start again on the way back. Links are followed by keyboard, which
// the cats never touch, so no cat on the page can get in the way.
test.skip(!process.env.E2E_POSTGRES_URL, 'needs a database (POSTGRES_URL)');

test('cats stop coming on /cats and start again back on the dashboard', async ({ page }) => {
  // Chaos (a first cat within 3 s) keeps the waits short. Before the login, so the
  // dashboard runs at chaos from its first render.
  await page.addInitScript(() => localStorage.setItem('xenocats:intensity', 'chaos'));
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Email').fill('user@nextmail.com');
  await page.getByLabel('Password', { exact: true }).fill('123456');
  await page.getByRole('button', { name: /log in/i }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByTestId('xenocat-page')).toHaveAttribute('data-cat-intensity', 'chaos');

  await page.getByRole('link', { name: 'Meet the cats' }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/cats$/);
  await expect(page.getByRole('heading', { name: 'The cats' })).toBeVisible();
  // Summoned cats only: no intensity, no cat left over from the dashboard, and none
  // arriving in longer than chaos ever takes to bring one.
  await expect(page.getByTestId('xenocat-page')).not.toHaveAttribute('data-cat-intensity');
  await expect(page.getByTestId('xenocat')).toHaveCount(0);
  await page.waitForTimeout(4_000);
  await expect(page.getByTestId('xenocat')).toHaveCount(0);

  await page.getByRole('link', { name: 'Back to the dashboard' }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByTestId('xenocat-page')).toHaveAttribute('data-cat-intensity', 'chaos');
  await expect
    .poll(() => page.getByTestId('xenocat').count(), { timeout: 4_000 })
    .toBeGreaterThanOrEqual(1);
});
