import { type Page, expect, test } from './fixtures';
import { DEMO_USER } from './demo-user';

// The invoice list's status filter, logged in as the demo user against the test
// schema global-setup.ts rebuilds. It only reads: tests that run alongside may add
// invoices, so it asserts on what each row says, never on counts beyond the seed.
test.skip(!process.env.E2E_POSTGRES_URL, 'needs a database (POSTGRES_URL)');
test.use({ storageState: DEMO_USER });

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
  // A status it does not know: the filter shows every status (the list does the
  // same, parseStatusFilter in schemas.test.ts).
  await page.goto('/dashboard/invoices?status=bogus');
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

// What the list does with a status or page number it does not know, and when a new
// invoice is due, are unit tests: parseStatusFilter (schemas.test.ts), parsePage
// (utils.test.ts), and the status filter and due dates in data.test.ts.
