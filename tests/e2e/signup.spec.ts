import { type Page, expect, test } from './fixtures';

// Making an account on /signup with a username and a password (no email), against
// the test schema global-setup.ts rebuilds: each test's username is its own.
test.skip(!process.env.E2E_POSTGRES_URL, 'needs a database (POSTGRES_URL)');

const PASSWORD = 'a-good-password';

/** A username no other test (or run) has: at most 20 characters. */
const freshUsername = () =>
  `kit${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

async function signUp(page: Page, username: string) {
  await page.goto('/signup');
  // Filled before hydration, the form would be reset under the test's hands.
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Password again').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
}

test('an account made with a username is signed in, sees none of the demo data, and logs in again by its username', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const username = freshUsername();
  await signUp(page, username);
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });

  // Its own invoices only: it has none, and the demo user's are not among them.
  await page.goto('/dashboard/invoices');
  await expect(page.getByRole('heading', { name: 'Invoices' })).toBeVisible();
  await expect(page.getByText('Evil Rabbit')).toHaveCount(0);

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  // Whatever its case.
  await page.getByLabel('Username or email').fill(username.toUpperCase());
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: /log in/i }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
});

test('a username already taken is refused, whatever its case', async ({ page }) => {
  test.setTimeout(90_000);
  const username = freshUsername();
  await signUp(page, username);
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
  await page.context().clearCookies();

  await signUp(page, username.toUpperCase());
  await expect(page.getByText('That username is taken.')).toBeVisible();
  await expect(page).toHaveURL(/\/signup$/);
});

test('the login page leads to /signup, and /signup back to the login', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('link', { name: 'Create an account' }).click();
  await expect(page).toHaveURL(/\/signup$/);
  await page.getByRole('link', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/login$/);
});
