import { expect, test as setup } from '@playwright/test';
import { DEMO_USER } from './demo-user';

// Logs the demo user in through the form, once per run, and saves the session for
// the specs that use DEMO_USER. Every browser-test project depends on this one.
// Without a database there is no one to log in, and those specs skip.
setup('log the demo user in', async ({ page }) => {
  setup.skip(!process.env.E2E_POSTGRES_URL, 'needs a database (POSTGRES_URL)');
  await page.goto('/login');
  // Filled before hydration, the form would be reset under the test's hands.
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Email').fill('user@nextmail.com');
  await page.getByLabel('Password', { exact: true }).fill('123456');
  await page.getByRole('button', { name: /log in/i }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
  await page.context().storageState({ path: DEMO_USER });
});
