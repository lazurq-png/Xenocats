import { expect, test } from '@playwright/test';

// Pages behind the login, against the test schema global-setup.ts rebuilds from
// app/lib/placeholder-data.ts. Skipped where no database is configured.
test.skip(!process.env.E2E_POSTGRES_URL, 'needs a database (POSTGRES_URL)');

test('the demo user logs in and the dashboard shows the seeded data', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('user@nextmail.com');
  await page.getByLabel('Password', { exact: true }).fill('123456');
  await page.getByRole('button', { name: /log in/i }).click();

  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();

  // Searched, so invoices other tests add (they sort first, by date) cannot push it off page 1.
  await page.goto('/dashboard/invoices?query=Evil%20Rabbit');
  await expect(page.getByRole('heading', { name: 'Invoices' })).toBeVisible();
  // The desktop table; the same rows also render in a list that is hidden at this width.
  await expect(page.getByRole('cell', { name: 'Evil Rabbit' }).first()).toBeVisible();
});

// An email no user has gets the same answer as a wrong password. (A wrong password
// for a real user is in login-limit.spec.ts, on a user of its own: a failed login
// counts towards a lockout, so no test fails the demo user's.)
test('an unknown email is refused like a wrong password', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(`nobody-${Date.now().toString(36)}@example.com`);
  await page.getByLabel('Password', { exact: true }).fill('not-the-password');
  await page.getByRole('button', { name: /log in/i }).click();

  await expect(page.getByText(/invalid credentials/i)).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});
