import { expect, test } from './fixtures';
import { DEMO_USER } from './demo-user';

// The home page's period picker: all time unless the URL asks for the last 12 months.
test.skip(!process.env.E2E_POSTGRES_URL, 'needs a database (POSTGRES_URL)');
test.use({ storageState: DEMO_USER });

test('the home page shows all time by default', async ({ page }) => {
  await page.goto('/dashboard');
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
