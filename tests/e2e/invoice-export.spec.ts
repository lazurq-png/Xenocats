import { readFileSync } from 'node:fs';
import { type Page, expect, test } from '@playwright/test';

// The CSV export of the invoice list, against the test schema global-setup.ts
// rebuilds. The test makes its own customer, named like a spreadsheet formula, and
// its own invoice, and asserts only on them.
test.skip(!process.env.E2E_POSTGRES_URL, 'needs a database (POSTGRES_URL)');

async function logIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('user@nextmail.com');
  await page.getByLabel('Password', { exact: true }).fill('123456');
  await page.getByRole('button', { name: /log in/i }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
}

test('the export is the filtered list as CSV, with formulas made harmless', async ({ page }) => {
  test.setTimeout(60_000);
  await logIn(page);
  const tag = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const name = `=1+1 Formula ${tag}`;

  await page.goto('/dashboard/customers/create');
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Name').fill(name);
  await page.getByLabel('Email').fill(`${tag}@example.com`);
  await page.getByRole('button', { name: 'Create Customer' }).click();
  await expect(page).toHaveURL(/\/dashboard\/customers$/, { timeout: 15_000 });

  await page.goto('/dashboard/invoices/create');
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Choose customer').selectOption({ label: name });
  await page.getByLabel('Choose an amount').fill('12.34');
  await page.getByLabel('Pending').check();
  await page.getByRole('button', { name: 'Create Invoice' }).click();
  await expect(page).toHaveURL(/\/dashboard\/invoices$/, { timeout: 15_000 });

  // The list filtered to this customer's pending invoices; the link keeps both.
  await page.goto(`/dashboard/invoices?query=${tag}&status=pending`);
  const link = page.getByRole('link', { name: 'Export CSV' });
  await expect(link).toHaveAttribute(
    'href',
    `/dashboard/invoices/export?query=${tag}&status=pending`
  );

  const [download] = await Promise.all([page.waitForEvent('download'), link.click()]);
  expect(download.suggestedFilename()).toBe('invoices.csv');
  const csv = readFileSync((await download.path())!, 'utf8').replace(/^\uFEFF/, '');
  const lines = csv.split('\r\n').filter(Boolean);
  expect(lines[0]).toBe('Date,Due,Customer,Email,Amount,Status');
  // Only this customer's invoice, due 30 days after today, and the name can no
  // longer run as a formula.
  const day = (offset: number) =>
    new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
  expect(lines.slice(1)).toEqual([
    `${day(0)},${day(30)},'${name},${tag}@example.com,12.34,pending`,
  ]);
});

test('a visitor who is not logged in gets no CSV', async ({ request }) => {
  const response = await request.get('/dashboard/invoices/export', { maxRedirects: 0 });
  expect(response.headers()['content-type'] ?? '').not.toContain('text/csv');
  expect([302, 303, 307, 401]).toContain(response.status());
});
