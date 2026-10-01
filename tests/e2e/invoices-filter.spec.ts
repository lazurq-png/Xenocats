import { type Page, expect, test } from '@playwright/test';

// The invoice list's status filter, logged in as the demo user against the test
// schema global-setup.ts rebuilds. It only reads: tests that run alongside may add
// invoices, so it asserts on what each row says, never on counts beyond the seed.
test.skip(!process.env.E2E_POSTGRES_URL, 'needs a database (POSTGRES_URL)');

async function logIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('user@nextmail.com');
  await page.getByLabel('Password', { exact: true }).fill('123456');
  await page.getByRole('button', { name: /log in/i }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

/** The desktop table's rows (the phone list is hidden at this width). */
const rows = (page: Page) => page.locator('table tbody tr');

const rowTexts = (page: Page) =>
  rows(page).evaluateAll((all) => all.map((row) => row.textContent ?? ''));

/**
 * Every row of the table (read at once: the list streams in anew after each URL
 * change) shows `status`, and the other status nowhere; and, if given, `text`.
 */
async function expectEveryRow(page: Page, status: 'Paid' | 'Pending', text?: string) {
  const other = status === 'Paid' ? 'Pending' : 'Paid';
  await expect
    .poll(async () => {
      const texts = await rows(page).evaluateAll((all) => all.map((row) => row.textContent ?? ''));
      return (
        texts.length > 0 &&
        texts.every((t) => t.includes(status) && !t.includes(other) && (!text || t.includes(text)))
      );
    })
    .toBe(true);
}

test('the status filter lives in the URL, combines with search and survives pagination', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await logIn(page);
  await page.goto('/dashboard/invoices');
  const filter = page.getByLabel('Status');
  await expect(filter).toHaveValue('');

  await filter.selectOption('paid');
  await expect(page).toHaveURL(/[?&]status=paid/, { timeout: 15_000 });
  await expectEveryRow(page, 'Paid');
  const firstPage = await rowTexts(page);

  // Eight seeded invoices are paid: two pages. Page 2 keeps the filter, and shows
  // other paid invoices than page 1.
  await page.getByRole('link', { name: '2', exact: true }).click();
  await expect(page).toHaveURL(/status=paid/);
  await expect(page).toHaveURL(/page=2/);
  await expectEveryRow(page, 'Paid');
  await expect
    .poll(async () => (await rowTexts(page)).every((text) => !firstPage.includes(text)))
    .toBe(true);
  await expect(filter).toHaveValue('paid');

  // With a search: both apply, and the page goes back to 1. Balazs Orban has paid
  // and pending invoices, so each filter shows only some of his.
  await page.getByPlaceholder('Search invoices...').fill('Balazs Orban');
  await expect(page).toHaveURL(/query=Balazs\+Orban/);
  await expect(page).toHaveURL(/page=1/);
  await expect(page).toHaveURL(/status=paid/);
  await expectEveryRow(page, 'Paid', 'Balazs Orban');
  await filter.selectOption('pending');
  await expect(page).toHaveURL(/status=pending/);
  await expect(page).toHaveURL(/query=Balazs\+Orban/);
  await expectEveryRow(page, 'Pending', 'Balazs Orban');

  // Every status again (the search still applies).
  await filter.selectOption('');
  await expect(page).not.toHaveURL(/status=/);
  await expect(rows(page).filter({ hasText: 'Paid' }).first()).toBeVisible();
  await expect(rows(page).filter({ hasText: 'Pending' }).first()).toBeVisible();
});

test('an unknown status in the URL shows every invoice', async ({ page }) => {
  await logIn(page);
  await page.goto('/dashboard/invoices?status=bogus');
  await expect(page.getByLabel('Status')).toHaveValue('');
  await expect(rows(page).filter({ hasText: 'Paid' }).first()).toBeVisible();
  await expect(rows(page).filter({ hasText: 'Pending' }).first()).toBeVisible();
});
