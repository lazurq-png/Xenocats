import bcryptjs from 'bcryptjs';
import postgres from 'postgres';
import { type Page, expect, test } from '@playwright/test';

// The login lockout, against the test schema global-setup.ts rebuilds. Each test
// makes a user of its own (written straight into the test schema: there is no
// sign-up page), so the demo user others log in as is never locked.
test.skip(!process.env.E2E_POSTGRES_URL, 'needs a database (POSTGRES_URL)');

// LOGIN_MAX_FAILURES, as playwright.config.ts gives it to the test server.
const maxFailures = 5;
const PASSWORD = 'right-password';

async function createUser() {
  const email = `lockout-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@example.com`;
  const sql = postgres(process.env.E2E_POSTGRES_URL!, { ssl: 'require', max: 1 });
  try {
    await sql`
      INSERT INTO users (name, email, password)
      VALUES ('Lockout Test', ${email}, ${await bcryptjs.hash(PASSWORD, 10)})`;
  } finally {
    await sql.end();
  }
  return email;
}

async function logIn(page: Page, email: string, password: string) {
  await page.goto('/login');
  // Filled before hydration, the form would be reset under the test's hands, and
  // the message the test waits for would never come.
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: /log in/i }).click();
}

async function failLogIn(page: Page, email: string) {
  await logIn(page, email, 'wrong-password');
  await expect(page.getByText('Invalid credentials.')).toBeVisible();
}

test(`after ${maxFailures} failed logins the email is refused, even with the right password`, async ({
  page,
}) => {
  test.setTimeout(90_000);
  const email = await createUser();
  for (let i = 0; i < maxFailures; i++) await failLogIn(page, email);

  await logIn(page, email.toUpperCase(), PASSWORD);
  await expect(
    page.getByText('Too many failed logins for this email. Try again later.')
  ).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test('a successful login starts the count again', async ({ page }) => {
  test.setTimeout(90_000);
  const email = await createUser();
  for (let i = 0; i < maxFailures - 1; i++) await failLogIn(page, email);
  await logIn(page, email, PASSWORD);
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

  // As many failures again would have locked it, had the count not started over.
  await page.context().clearCookies();
  for (let i = 0; i < maxFailures - 1; i++) await failLogIn(page, email);
  await logIn(page, email, PASSWORD);
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
});
