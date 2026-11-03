import { expect, test } from './fixtures';
import { DEMO_USER } from './demo-user';

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

// The login's `callbackUrl` comes from the address bar (the proxy sets it, but anyone
// can write one): Auth.js's redirect callback keeps it on this site. Each address is
// one a link from elsewhere could carry; after the login the visitor is still here.
test('a login never sends the visitor to another site, whatever callbackUrl says', async ({
  page,
  baseURL,
}) => {
  const site = new URL(baseURL!);
  for (const callbackUrl of [
    'https://evil.example/phish',
    '//evil.example/phish',
    '/\\evil.example/phish',
    // What a check by prefix ("starts with this site") would let through.
    `${site.protocol}//${site.hostname}.evil.example:${site.port}/phish`,
    `${site.protocol}//${site.host}@evil.example/phish`,
  ]) {
    await page.context().clearCookies();
    await page.goto(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
    await page.getByLabel('Email').fill('user@nextmail.com');
    await page.getByLabel('Password', { exact: true }).fill('123456');
    await page.getByRole('button', { name: /log in/i }).click();
    // Once the login page is left (its own heading also says welcome back, so a heading
    // proves nothing), the visitor is on this site: the dashboard, or its home page
    // where Auth.js falls back from an address it refuses.
    // (A poll of the address: Next's navigation after the login may fire no load event.)
    await expect
      .poll(() => new URL(page.url()).pathname, { message: callbackUrl, timeout: 15_000 })
      .not.toBe('/login');
    expect(new URL(page.url()).origin, callbackUrl).toBe(site.origin);
  }
});

// The browser tests' pause (fixtures.ts): this group's specs run with the cats paused.
// Chaos always has a cat on screen within 9 s (intensity.spec.ts, which runs unpaused).
test.describe('with the cats paused', () => {
  test.use({ storageState: DEMO_USER });

  test('no cat comes on the dashboard, even at chaos', async ({ page }) => {
    await page.clock.install();
    await page.addInitScript(() => localStorage.setItem('xenocats:intensity', 'chaos'));
    await page.goto('/dashboard');
    await expect(page.getByTestId('xenocat-page')).toHaveAttribute('data-cat-intensity', 'chaos');
    for (let waited = 0; waited < 15_000; waited += 1_000) await page.clock.runFor(1_000);
    await expect(page.getByTestId('xenocat')).toHaveCount(0);
  });
});

// Pending means unpaid and not yet due, as the invoice list uses it. The
// dashboard's and the customer list's totals count every unpaid invoice, overdue
// included, so they say Unpaid.
test.describe('totals of every unpaid invoice', () => {
  test.use({ storageState: DEMO_USER });

  test('are called Unpaid on the dashboard and the customer list, never Pending', async ({
    page,
  }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Unpaid', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Pending', exact: true })).toHaveCount(0);
    // The revenue chart's legend, and its table of the same figures.
    const legend = page.getByRole('listitem').filter({ hasText: /^\s*(Unpaid|Pending)\s*$/ });
    await expect(legend).toHaveCount(1);
    await expect(legend).toHaveText('Unpaid');
    await expect(page.getByRole('columnheader', { name: 'Unpaid', exact: true })).toHaveCount(1);
    await expect(page.getByRole('columnheader', { name: 'Pending', exact: true })).toHaveCount(0);

    await page.goto('/dashboard/customers');
    await expect(page.getByRole('columnheader', { name: 'Total Unpaid' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Total Pending' })).toHaveCount(0);
  });
});
