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
 * change) shows `status`, and the other statuses nowhere; and, if given, `text`.
 */
async function expectEveryRow(page: Page, status: Shown, text?: string) {
  const others = SHOWN.filter((other) => other !== status);
  await expect
    .poll(async () => {
      const texts = await rows(page).evaluateAll((all) => all.map((row) => row.textContent ?? ''));
      return (
        texts.length > 0 &&
        texts.every(
          (t) =>
            t.includes(status) &&
            others.every((other) => !t.includes(other)) &&
            (!text || t.includes(text))
        )
      );
    })
    .toBe(true);
}

/** What a row's status pill can say: every invoice is exactly one of these. */
const SHOWN = ['Paid', 'Pending', 'Overdue'] as const;
type Shown = (typeof SHOWN)[number];

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
  // other paid invoices than page 1. Some, not all: a test running alongside may
  // mark a new invoice paid (dated today, it goes first), moving page 1's last
  // row onto page 2 between the two reads.
  await page.getByRole('link', { name: '2', exact: true }).click();
  await expect(page).toHaveURL(/status=paid/);
  await expect(page).toHaveURL(/page=2/);
  await expectEveryRow(page, 'Paid');
  await expect
    .poll(async () => {
      const texts = await rowTexts(page);
      return (
        texts.every((text) => text.includes('Paid')) &&
        texts.some((text) => !firstPage.includes(text))
      );
    })
    .toBe(true);
  await expect(filter).toHaveValue('paid');

  // With a search: both apply, and the page goes back to 1. Balazs Orban has paid
  // and unpaid invoices, the unpaid ones long past due (seeded in 2022-2023), so
  // each filter shows only some of his.
  await page.getByPlaceholder('Search invoices...').fill('Balazs Orban');
  await expect(page).toHaveURL(/query=Balazs\+Orban/);
  await expect(page).toHaveURL(/page=1/);
  await expect(page).toHaveURL(/status=paid/);
  await expectEveryRow(page, 'Paid', 'Balazs Orban');
  await filter.selectOption('overdue');
  await expect(page).toHaveURL(/status=overdue/);
  await expect(page).toHaveURL(/query=Balazs\+Orban/);
  await expectEveryRow(page, 'Overdue', 'Balazs Orban');

  // Pending is unpaid and not yet due: none of his (no test adds invoices for
  // him). Loaded afresh, since a page load waits for the whole streamed list.
  await page.goto('/dashboard/invoices?query=Balazs+Orban&status=pending');
  await expect(filter).toHaveValue('pending');
  await expect(rows(page)).toHaveCount(0);

  // Every status again (the search still applies).
  await filter.selectOption('');
  await expect(page).not.toHaveURL(/status=/);
  await expect(rows(page).filter({ hasText: 'Paid' }).first()).toBeVisible();
  await expect(rows(page).filter({ hasText: 'Overdue' }).first()).toBeVisible();
});

test('an unknown status in the URL shows every invoice', async ({ page }) => {
  await logIn(page);
  // Searched, so invoices other tests add cannot push the seeded ones off page 1.
  await page.goto('/dashboard/invoices?status=bogus&query=Balazs+Orban');
  await expect(page.getByLabel('Status')).toHaveValue('');
  await expect(rows(page).filter({ hasText: 'Paid' }).first()).toBeVisible();
  await expect(rows(page).filter({ hasText: 'Overdue' }).first()).toBeVisible();
});

test('a new unpaid invoice is due in 30 days: pending, not overdue', async ({ page }) => {
  test.setTimeout(60_000);
  await logIn(page);
  const tag = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const name = `Due Date ${tag}`;

  await page.goto('/dashboard/customers/create');
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Name').fill(name);
  await page.getByLabel('Email').fill(`${tag}@example.com`);
  await page.getByRole('button', { name: 'Create Customer' }).click();
  await expect(page).toHaveURL(/\/dashboard\/customers$/, { timeout: 15_000 });

  await page.goto('/dashboard/invoices/create');
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Choose customer').selectOption({ label: name });
  await page.getByLabel('Choose an amount').fill('40.00');
  await page.getByLabel('Pending').check();
  await page.getByRole('button', { name: 'Create Invoice' }).click();
  await expect(page).toHaveURL(/\/dashboard\/invoices$/, { timeout: 15_000 });

  // Listed as pending, under the pending filter and not under overdue.
  await page.goto(`/dashboard/invoices?query=${tag}&status=pending`);
  await expectEveryRow(page, 'Pending', name);
  await page.goto(`/dashboard/invoices?query=${tag}&status=overdue`);
  // A page load waits for the whole streamed list, so an empty table is final.
  await expect(page.getByLabel('Status')).toHaveValue('overdue');
  await expect(rows(page)).toHaveCount(0);

  // The detail page gives its due date: 30 days after today.
  await page.goto(`/dashboard/invoices?query=${tag}`);
  await rows(page).first().getByRole('link', { name: /view/i }).click();
  const due = new Date(Date.now() + 30 * 86_400_000);
  const shown = due.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
  await expect(page.getByText('Due', { exact: true })).toBeVisible();
  await expect(page.getByText(shown)).toHaveCount(1);
});

test('a page number that makes no sense shows the first page, not an error', async ({ page }) => {
  await logIn(page);
  for (const value of ['-1', '0', '2.5', 'abc']) {
    await page.goto(`/dashboard/invoices?page=${value}`);
    // Real rows (they show amounts; the loading skeleton does not), then no error:
    // the list streams in after the page, and so would an error.
    await expect(rows(page).filter({ hasText: '$' }).first()).toBeVisible();
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Something went wrong!' })).toHaveCount(0);
  }
});
