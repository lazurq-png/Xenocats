import { expect, test } from '@playwright/test';

// The cat intensity setting on the settings page: chosen there, remembered in this
// browser (localStorage), and applied to the dashboard's cats. Each test has a
// browser context of its own, so its choice reaches no other test.
test.skip(!process.env.E2E_POSTGRES_URL, 'needs a database (POSTGRES_URL)');

test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Email').fill('user@nextmail.com');
  await page.getByLabel('Password', { exact: true }).fill('123456');
  await page.getByRole('button', { name: /log in/i }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
});

test('chaos is chosen on the settings page, remembered, and brings cats at once', async ({
  page,
}) => {
  await page.goto('/dashboard/settings');
  await page.waitForLoadState('networkidle');
  const group = page.getByRole('group', { name: 'Cat intensity' });
  // Normal until chosen otherwise; there is no "none".
  await expect(group.getByRole('radio')).toHaveCount(3);
  await expect(group.getByRole('radio', { name: /Normal/ })).toBeChecked();

  await group.getByRole('radio', { name: /Chaos/ }).check();
  expect(await page.evaluate(() => localStorage.getItem('xenocats:intensity'))).toBe('chaos');
  await expect(page.getByTestId('xenocat-page')).toHaveAttribute('data-cat-intensity', 'chaos');

  // Remembered across pages and reloads.
  await page.goto('/dashboard');
  await page.reload();
  await expect(page.getByTestId('xenocat-page')).toHaveAttribute('data-cat-intensity', 'chaos');
  // The engine runs at chaos, not just the setting: chaos always has two cats
  // within 9 s (the first by 3 s, the next at most 6 s later); normal never does
  // (3 s + 7 s at the earliest), calm never (at most one before 35 s).
  await expect
    .poll(() => page.getByTestId('xenocat').count(), { timeout: 9_500 })
    .toBeGreaterThanOrEqual(2);

  await page.goto('/dashboard/settings');
  await expect(
    page.getByRole('group', { name: 'Cat intensity' }).getByRole('radio', { name: /Chaos/ })
  ).toBeChecked();
});

test('calm is chosen by keyboard, and back to normal', async ({ page }) => {
  await page.goto('/dashboard/settings');
  await page.waitForLoadState('networkidle');
  const group = page.getByRole('group', { name: 'Cat intensity' });
  await group.getByRole('radio', { name: /Normal/ }).focus();
  // Arrow keys move through a radio group, choosing as they go.
  await page.keyboard.press('ArrowLeft');
  await expect(group.getByRole('radio', { name: /Calm/ })).toBeChecked();
  expect(await page.evaluate(() => localStorage.getItem('xenocats:intensity'))).toBe('calm');
  await expect(page.getByTestId('xenocat-page')).toHaveAttribute('data-cat-intensity', 'calm');
  await page.keyboard.press('ArrowRight');
  await expect(group.getByRole('radio', { name: /Normal/ })).toBeChecked();
});
