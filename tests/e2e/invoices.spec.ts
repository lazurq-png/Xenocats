import { type Page, expect, test } from './fixtures';
import { addDays } from '@/app/lib/schemas';
import { formatDateToLocal } from '@/app/lib/utils';
import { DEMO_USER } from './demo-user';

// Invoice create, edit and delete through the forms, logged in as the demo user,
// against the test schema global-setup.ts rebuilds. Each test makes its own
// invoice, with an amount no other invoice has, and asserts only on it. A form
// the action refuses, error by error, is tests/unit/forms.test.tsx.
test.skip(!process.env.E2E_POSTGRES_URL, 'needs a database (POSTGRES_URL)');
test.use({ storageState: DEMO_USER });

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

test('an invoice is created and listed', async ({ page }) => {
  const cents = uniqueCents();
  await createInvoice(page, cents);
  const row = await rowsFor(page, cents);
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('Amy Burns');
  await expect(row).toContainText('Pending');
});

test('an invoice is edited, and the change is saved', async ({ page }) => {
  test.setTimeout(60_000);
  const cents = uniqueCents();
  await createInvoice(page, cents);

  await (await rowsFor(page, cents)).getByRole('link', { name: 'Edit' }).click();
  await expect(page).toHaveURL(/\/dashboard\/invoices\/[0-9a-f-]{36}\/edit$/, { timeout: 15_000 });
  await page.waitForLoadState('networkidle');
  const amount = page.getByLabel('Choose an amount');
  expect(Number(await amount.inputValue())).toBe(cents / 100);

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
  await expect(page).toHaveURL(/\/dashboard\/invoices\/[0-9a-f-]{36}\/edit$/, { timeout: 15_000 });
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
