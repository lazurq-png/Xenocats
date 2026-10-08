import { type Page, expect, test } from '@playwright/test';
import { addDays } from '@/app/lib/schemas';
import { formatDateToLocal } from '@/app/lib/utils';

// Invoice create, edit and delete through the forms, logged in as the demo user,
// against the test schema global-setup.ts rebuilds. Each test makes its own
// invoice, with an amount no other invoice has, and asserts only on it.
test.skip(!process.env.E2E_POSTGRES_URL, 'needs a database (POSTGRES_URL)');

async function logIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('user@nextmail.com');
  await page.getByLabel('Password', { exact: true }).fill('123456');
  await page.getByRole('button', { name: /log in/i }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

/** An amount in cents that no seeded or other test's invoice has. */
const uniqueCents = () => 1_000_000 + Math.floor(Math.random() * 8_999_999);

const dollars = (cents: number) =>
  (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

async function openCreateForm(page: Page) {
  await page.goto('/dashboard/invoices/create');
  // Filled before hydration, the form would be reset under the test's hands.
  await page.waitForLoadState('networkidle');
}

/** Creates a pending invoice for Amy Burns for `cents`. */
async function createInvoice(page: Page, cents: number) {
  await openCreateForm(page);
  await page.getByLabel('Choose customer').selectOption({ label: 'Amy Burns' });
  await page.getByLabel('Choose an amount').fill((cents / 100).toFixed(2));
  await page.getByLabel('Pending').check();
  await page.getByRole('button', { name: 'Create Invoice' }).click();
  await expect(page).toHaveURL(/\/dashboard\/invoices$/, { timeout: 15_000 });
}

/** The invoice list's rows for that amount (the search matches cents). */
async function rowsFor(page: Page, cents: number) {
  await page.goto(`/dashboard/invoices?query=${cents}`);
  return page.locator('table tbody tr').filter({ hasText: dollars(cents) });
}

test('an incomplete create form is refused with an error per field, and nothing is created', async ({
  page,
}) => {
  await logIn(page);
  await openCreateForm(page);
  await page.getByRole('button', { name: 'Create Invoice' }).click();

  // Each error is in the region its field names with aria-describedby.
  await expect(page.locator('#customer-error')).toHaveText('Please select a customer.');
  await expect(page.locator('#amount-error')).toHaveText('Please enter an amount greater than $0');
  await expect(page.locator('#status-error')).toHaveText('Please select an invoice status.');
  await expect(page.getByLabel('Choose an amount')).toHaveAttribute(
    'aria-describedby',
    'amount-error'
  );
  await expect(page).toHaveURL(/\/dashboard\/invoices\/create$/);

  // Valid but for the missing status: refused for that alone, and no invoice
  // with that (unique) amount exists afterwards.
  const cents = uniqueCents();
  await page.getByLabel('Choose customer').selectOption({ label: 'Amy Burns' });
  await page.getByLabel('Choose an amount').fill((cents / 100).toFixed(2));
  await page.getByRole('button', { name: 'Create Invoice' }).click();
  await expect(page.locator('#status-error')).toHaveText('Please select an invoice status.');
  await expect(page.locator('#customer-error')).toBeEmpty();
  await expect(page.locator('#amount-error')).toBeEmpty();
  await expect(page).toHaveURL(/\/dashboard\/invoices\/create$/);
  await expect(await rowsFor(page, cents)).toHaveCount(0);
});

test('an invoice is created and listed', async ({ page }) => {
  test.setTimeout(60_000);
  await logIn(page);
  const cents = uniqueCents();
  await openCreateForm(page);

  // A zero amount is refused first; the other fields' choices are not errors.
  await page.getByLabel('Choose customer').selectOption({ label: 'Amy Burns' });
  await page.getByLabel('Choose an amount').fill('0');
  await page.getByLabel('Paid').check();
  await page.getByRole('button', { name: 'Create Invoice' }).click();
  await expect(page.locator('#amount-error')).toHaveText('Please enter an amount greater than $0');
  await expect(page.locator('#customer-error')).toBeEmpty();
  await expect(page.locator('#status-error')).toBeEmpty();
  await expect(page).toHaveURL(/\/dashboard\/invoices\/create$/);

  await createInvoice(page, cents);
  const row = await rowsFor(page, cents);
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('Amy Burns');
  await expect(row).toContainText('Pending');
});

test('an invoice is edited: a bad amount is refused, then the change is saved', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await logIn(page);
  const cents = uniqueCents();
  await createInvoice(page, cents);

  await (await rowsFor(page, cents)).getByRole('link', { name: 'Edit' }).click();
  await expect(page).toHaveURL(/\/dashboard\/invoices\/[0-9a-f-]{36}\/edit$/);
  await page.waitForLoadState('networkidle');
  const amount = page.getByLabel('Choose an amount');
  expect(Number(await amount.inputValue())).toBe(cents / 100);
  const editUrl = page.url();

  await amount.fill('-5');
  await page.getByRole('button', { name: 'Edit Invoice' }).click();
  await expect(page.locator('#amount-error')).toHaveText('Please enter an amount greater than $0');
  await expect(page).toHaveURL(editUrl);

  // Saved: a new amount and paid; the old amount is gone from the list.
  const newCents = uniqueCents();
  await amount.fill((newCents / 100).toFixed(2));
  await page.getByLabel('Paid').check();
  await page.getByRole('button', { name: 'Edit Invoice' }).click();
  await expect(page).toHaveURL(/\/dashboard\/invoices$/, { timeout: 15_000 });
  const row = await rowsFor(page, newCents);
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('Amy Burns');
  await expect(row).toContainText('Paid');
  await expect(await rowsFor(page, cents)).toHaveCount(0);
});

test('an invoice is due when the form says: 30 days by default, never before its date', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await logIn(page);
  const cents = uniqueCents();
  // Dated today (the server's date, in UTC, as here).
  const today = new Date().toISOString().slice(0, 10);

  await openCreateForm(page);
  const due = page.getByLabel('Due date');
  await expect(due).toHaveValue(addDays(today, 30));
  await page.getByLabel('Choose customer').selectOption({ label: 'Amy Burns' });
  await page.getByLabel('Choose an amount').fill((cents / 100).toFixed(2));
  await page.getByLabel('Pending').check();
  await due.fill(addDays(today, 45));
  await page.getByRole('button', { name: 'Create Invoice' }).click();
  await expect(page).toHaveURL(/\/dashboard\/invoices$/, { timeout: 15_000 });

  // The list shows it, under its own heading.
  await expect(page.getByRole('columnheader', { name: 'Due', exact: true })).toBeVisible();
  // One row (the list streams in, and for a moment can be there twice), then its date.
  const listed = await rowsFor(page, cents);
  await expect(listed).toHaveCount(1);
  await expect(listed).toContainText(formatDateToLocal(addDays(today, 45)));

  // Kept: the edit form shows it.
  await (await rowsFor(page, cents)).getByRole('link', { name: 'Edit' }).click();
  await expect(page).toHaveURL(/\/dashboard\/invoices\/[0-9a-f-]{36}\/edit$/);
  await page.waitForLoadState('networkidle');
  await expect(due).toHaveValue(addDays(today, 45));
  const editUrl = page.url();

  // Before the invoice's date: refused, in the field's own error region.
  await due.fill(addDays(today, -1));
  await page.getByRole('button', { name: 'Edit Invoice' }).click();
  await expect(page.locator('#due-date-error')).toHaveText(
    'The due date cannot be before the invoice date.'
  );
  await expect(due).toHaveAttribute('aria-describedby', 'due-date-help due-date-error');
  await expect(page).toHaveURL(editUrl);

  // A later one is saved.
  await due.fill(addDays(today, 60));
  await page.getByRole('button', { name: 'Edit Invoice' }).click();
  await expect(page).toHaveURL(/\/dashboard\/invoices$/, { timeout: 15_000 });
  await page.goto(editUrl);
  await page.waitForLoadState('networkidle');
  await expect(due).toHaveValue(addDays(today, 60));
});

test('an invoice is deleted, and stays deleted after a reload', async ({ page }) => {
  test.setTimeout(60_000);
  await logIn(page);
  const cents = uniqueCents();
  await createInvoice(page, cents);

  const row = await rowsFor(page, cents);
  await row
    .getByRole('button', { name: `Delete invoice for Amy Burns, ${dollars(cents)}` })
    .click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete invoice' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(row).toHaveCount(0);

  // A fresh load of the list (a page load waits for the whole streamed table).
  await expect(await rowsFor(page, cents)).toHaveCount(0);
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('an invoice card shows its own due date under its date', async ({ page }) => {
    test.setTimeout(60_000);
    await logIn(page);
    // An invoice due 45 days on: not the default, so the card must show its due date.
    const cents = uniqueCents();
    const today = new Date().toISOString().slice(0, 10);
    await openCreateForm(page);
    await page.getByLabel('Choose customer').selectOption({ label: 'Amy Burns' });
    await page.getByLabel('Choose an amount').fill((cents / 100).toFixed(2));
    await page.getByLabel('Pending').check();
    await page.getByLabel('Due date').fill(addDays(today, 45));
    await page.getByRole('button', { name: 'Create Invoice' }).click();
    await expect(page).toHaveURL(/\/dashboard\/invoices$/, { timeout: 15_000 });

    await page.goto(`/dashboard/invoices?query=${cents}`);
    // The phone layout's cards (the table is hidden at this width).
    await expect(page.locator('table').first()).toBeHidden();
    // The search leaves only this invoice (its card can show twice for a moment as the
    // list streams in): its due date, under its date.
    await expect(
      page.getByText(`Due ${formatDateToLocal(addDays(today, 45))}`, { exact: true }).first()
    ).toBeVisible();
  });
});
