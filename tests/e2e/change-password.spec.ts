import bcryptjs from 'bcryptjs';
import postgres from 'postgres';
import { type Page, expect, test } from '@playwright/test';

// Changing the password on the settings page, against the test schema
// global-setup.ts rebuilds, as a user of the test's own (written straight into
// the schema: there is no sign-up page), so the demo user others log in as keeps
// its password.
test.skip(!process.env.E2E_POSTGRES_URL, 'needs a database (POSTGRES_URL)');

const OLD = 'old-password-1';
const NEW = 'new-password-2';

async function createUser() {
  const email = `password-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@example.com`;
  const sql = postgres(process.env.E2E_POSTGRES_URL!, { ssl: 'require', max: 1 });
  try {
    await sql`
      INSERT INTO users (name, email, password)
      VALUES ('Password Test', ${email}, ${await bcryptjs.hash(OLD, 10)})`;
  } finally {
    await sql.end();
  }
  return email;
}

async function logIn(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: /log in/i }).click();
}

async function submit(page: Page, current: string, next: string, confirm = next) {
  await page.getByLabel('Current password').fill(current);
  await page.getByLabel('New password', { exact: true }).fill(next);
  await page.getByLabel('Confirm new password').fill(confirm);
  await page.getByRole('button', { name: 'Change Password' }).click();
}

test('a logged-in user changes their password: the new one works, the old one no longer', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const email = await createUser();
  await logIn(page, email, OLD);
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

  // The side navigation leads there. Loaded afresh rather than through the link:
  // only a fresh page reliably goes network-idle (the sign of hydration) under
  // `next start`, which keeps prefetching the dashboard's links.
  await expect(page.getByRole('link', { name: 'Settings' }).first()).toHaveAttribute(
    'href',
    '/dashboard/settings'
  );
  await page.goto('/dashboard/settings');
  await expect(page.getByRole('heading', { name: 'Change password' })).toBeVisible();
  await page.waitForLoadState('networkidle');

  // Refused, each error beside its field: a wrong current password...
  await submit(page, 'not-my-password', NEW);
  await expect(page.locator('#currentPassword-error')).toHaveText(
    'That is not your current password.'
  );
  // ...and a confirmation that does not match.
  await submit(page, OLD, NEW, 'something-else');
  await expect(page.locator('#confirmPassword-error')).toHaveText(
    'The two new passwords do not match.'
  );
  await expect(page.getByLabel('Current password')).toHaveAttribute(
    'aria-describedby',
    'currentPassword-error'
  );

  await submit(page, OLD, NEW);
  await expect(page.getByText('Your password has been changed.')).toBeVisible();

  // Signed out: the old password is refused, the new one lets the user in.
  await page.context().clearCookies();
  await logIn(page, email, OLD);
  await expect(page.getByText('Invalid credentials.')).toBeVisible();
  await logIn(page, email, NEW);
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
});

test('the settings page is behind the login', async ({ page }) => {
  await page.goto('/dashboard/settings');
  await expect(page).toHaveURL(/\/login/);
});
