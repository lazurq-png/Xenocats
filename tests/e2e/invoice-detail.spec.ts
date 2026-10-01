import { type Page, expect, test } from '@playwright/test';

// The invoice detail page and the delete confirmation dialog, logged in as the
// demo user against the test schema global-setup.ts rebuilds. Each test makes its
// own pending invoice (an amount no other test uses) and asserts only on it.
test.skip(!process.env.E2E_POSTGRES_URL, 'needs a database (POSTGRES_URL)');

async function logIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('user@nextmail.com');
  await page.getByLabel('Password', { exact: true }).fill('123456');
  await page.getByRole('button', { name: /log in/i }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

/** Creates a pending invoice for Amy Burns with a unique amount; returns its cents. */
async function createInvoice(page: Page) {
  const cents = 1_000_000 + Math.floor(Math.random() * 8_999_999);
  await page.goto('/dashboard/invoices/create');
  // Filled before hydration, the form would be reset under the test's hands.
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Choose customer').selectOption({ label: 'Amy Burns' });
  await page.getByLabel('Choose an amount').fill((cents / 100).toFixed(2));
  await page.getByLabel('Pending').check();
  await page.getByRole('button', { name: 'Create Invoice' }).click();
  await expect(page).toHaveURL(/\/dashboard\/invoices$/, { timeout: 15_000 });
  return cents;
}

const dollars = (cents: number) =>
  (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

/** The invoice list searched down to that amount (the search matches cents). */
async function findInvoice(page: Page, cents: number) {
  await page.goto(`/dashboard/invoices?query=${cents}`);
  return page.locator('table tbody tr').filter({ hasText: dollars(cents) });
}

test('an invoice has a detail page, reached from the list', async ({ page }) => {
  await logIn(page);
  const cents = await createInvoice(page);
  const row = await findInvoice(page, cents);
  await row.getByRole('link', { name: `View invoice for Amy Burns, ${dollars(cents)}` }).click();
  await expect(page).toHaveURL(/\/dashboard\/invoices\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { name: 'Amy Burns' })).toBeVisible();
  const details = page.locator('dl');
  await expect(details).toContainText(dollars(cents));
  await expect(details).toContainText('amy@burns.com');
  await expect(page.getByText('Pending')).toBeVisible();
});

test('deleting asks first, in a dialog that keeps focus, cancels on Esc and gives focus back', async ({
  page,
}) => {
  await logIn(page);
  const cents = await createInvoice(page);
  const row = await findInvoice(page, cents);
  const trash = row.getByRole('button', {
    name: `Delete invoice for Amy Burns, ${dollars(cents)}`,
  });
  const dialog = page.getByRole('dialog', { name: 'Delete this invoice?' });

  await trash.click();
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(`invoice for Amy Burns, ${dollars(cents)}`);
  const cancel = dialog.getByRole('button', { name: 'Cancel' });
  const confirm = dialog.getByRole('button', { name: 'Delete invoice' });
  // The safe choice has the focus, and Tab stays inside the dialog.
  await expect(cancel).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(confirm).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(cancel).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(confirm).toBeFocused();

  // Esc cancels, and the focus goes back to the button that opened it.
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trash).toBeFocused();
  await expect(row).toHaveCount(1);

  // Cancel does the same.
  await trash.click();
  await cancel.click();
  await expect(dialog).toBeHidden();
  await expect(trash).toBeFocused();
  await expect(row).toHaveCount(1);

  // Confirming deletes it; focus lands on the search box (its row is gone).
  await trash.click();
  await confirm.click();
  await expect(dialog).toBeHidden();
  await expect(page.getByPlaceholder('Search invoices...')).toBeFocused();
  await expect(page.locator('table tbody tr').filter({ hasText: dollars(cents) })).toHaveCount(0);
});

test('deleting from the detail page goes back to the list', async ({ page }) => {
  await logIn(page);
  const cents = await createInvoice(page);
  const row = await findInvoice(page, cents);
  await row.getByRole('link', { name: /^View invoice/ }).click();
  await expect(page).toHaveURL(/\/dashboard\/invoices\/[0-9a-f-]{36}$/);
  const detail = page.url();
  await page.getByRole('button', { name: /^Delete invoice for Amy Burns/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete invoice' }).click();
  await expect(page).toHaveURL(/\/dashboard\/invoices$/, { timeout: 15_000 });
  await page.goto(detail);
  await expect(page.getByText('Could not find the requested invoice.')).toBeVisible();
});

test('an invoice that does not exist shows not found', async ({ page }) => {
  await logIn(page);
  for (const id of ['00000000-0000-4000-8000-000000000000', 'not-a-uuid']) {
    await page.goto(`/dashboard/invoices/${id}`);
    await expect(page.getByText('Could not find the requested invoice.')).toBeVisible();
  }
});
