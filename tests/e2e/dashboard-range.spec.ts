import { expect, test } from '@playwright/test';

// The home page's period picker: all time unless the URL asks for the last 12 months.
test.skip(!process.env.E2E_POSTGRES_URL, 'needs a database (POSTGRES_URL)');

test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Email').fill('user@nextmail.com');
  await page.getByLabel('Password', { exact: true }).fill('123456');
  await page.getByRole('button', { name: /log in/i }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
});

test('the home page shows all time by default', async ({ page }) => {
  const period = page.getByLabel('Period');
  await expect(period).toHaveValue('all');
  await expect(period.locator('option:checked')).toHaveText('All time');
});

test('?range=12m shows the last 12 months, and the picker changes it', async ({ page }) => {
  await page.goto('/dashboard?range=12m');
  const period = page.getByLabel('Period');
  await expect(period).toHaveValue('12m');
  await period.selectOption('all');
  await expect(page).toHaveURL(/range=all/);
  await expect(period).toHaveValue('all');
});
