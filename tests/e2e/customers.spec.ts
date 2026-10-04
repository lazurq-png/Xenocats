import { type Page, expect, test } from '@playwright/test';

// Customer create, edit and delete, logged in as the demo user, against the test
// schema global-setup.ts rebuilds. Each test makes its own customer and asserts
// only on it, since the tests run in parallel on one schema.
test.skip(!process.env.E2E_POSTGRES_URL, 'needs a database (POSTGRES_URL)');

async function logIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('user@nextmail.com');
  await page.getByLabel('Password', { exact: true }).fill('123456');
  await page.getByRole('button', { name: /log in/i }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

// After a submit, allow for the redirect's page still compiling under next dev.

/** A customer name no other test (or run) uses. */
const unique = (what: string) =>
  `${what} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

async function createCustomer(page: Page, name: string, email: string) {
  await page.goto('/dashboard/customers/create');
  await page.getByLabel('Name').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Create Customer' }).click();
  await expect(page).toHaveURL(/\/dashboard\/customers$/, { timeout: 15_000 });
}

/** The customer list, searched down to `name`. */
async function findCustomer(page: Page, name: string) {
  await page.goto(`/dashboard/customers?query=${encodeURIComponent(name)}`);
  return page.getByRole('row').filter({ hasText: name });
}

test('a customer is created, edited and deleted', async ({ page }) => {
  await logIn(page);
  const name = unique('Orbital Snacks');
  const email = `${name.split(' ').pop()}@example.com`;
  await createCustomer(page, name, email);

  let row = await findCustomer(page, name);
  await expect(row).toHaveCount(1);
  await expect(row).toContainText(email);

  // Edit: the form shows the current values; the list shows the new ones.
  await row.getByRole('link', { name: `Edit ${name}` }).click();
  await expect(page.getByLabel('Name')).toHaveValue(name);
  await expect(page.getByLabel('Email')).toHaveValue(email);
  const renamed = `${name} Ltd`;
  await page.getByLabel('Name').fill(renamed);
  await page.getByRole('button', { name: 'Save Customer' }).click();
  await expect(page).toHaveURL(/\/dashboard\/customers$/, { timeout: 15_000 });
  row = await findCustomer(page, renamed);
  await expect(row).toHaveCount(1);

  // Delete: a customer without invoices goes.
  await row.getByRole('button', { name: `Delete ${renamed}` }).click();
  await expect(page.getByRole('row').filter({ hasText: renamed })).toHaveCount(0);
});

test('the form says what is missing or wrong, next to each field', async ({ page }) => {
  await logIn(page);
  await page.goto('/dashboard/customers/create');
  // The browser's own check (type=email) lets this through; the server's does not.
  await page.getByLabel('Email').fill('zorg@nowhere');
  await page.getByRole('button', { name: 'Create Customer' }).click();
  await expect(page.locator('#name-error')).toHaveText('Please enter a name.');
  await expect(page.locator('#email-error')).toHaveText('Please enter a valid email address.');
  await expect(page.getByLabel('Name')).toHaveAttribute('aria-describedby', 'name-error');
  await expect(page.getByLabel('Email')).toHaveAttribute('aria-describedby', 'email-error');
  await expect(page).toHaveURL(/\/dashboard\/customers\/create$/);
});

test('a customer who still has invoices cannot be deleted, and the list says why', async ({
  page,
}) => {
  await logIn(page);
  const name = unique('Nebula Freight');
  await createCustomer(page, name, `${name.split(' ').pop()}@example.com`);

  // Give them an invoice.
  await page.goto('/dashboard/invoices/create');
  await page.getByLabel('Choose customer').selectOption({ label: name });
  await page.getByLabel('Choose an amount').fill('42');
  await page.getByLabel('Pending').check();
  await page.getByRole('button', { name: 'Create Invoice' }).click();
  await expect(page).toHaveURL(/\/dashboard\/invoices$/, { timeout: 15_000 });

  const row = await findCustomer(page, name);
  const remove = row.getByRole('button', { name: `Delete ${name}` });
  await remove.click();
  await expect(row).toContainText(
    'This customer still has invoices. Delete or reassign them first.'
  );
  // The message describes the button for assistive technology, and the customer stays.
  const describedBy = await remove.getAttribute('aria-describedby');
  await expect(page.locator(`[id="${describedBy}"]`)).toContainText('still has invoices');
  await page.reload();
  await expect(page.getByRole('row').filter({ hasText: name })).toHaveCount(1);
});

test('editing a customer that does not exist shows not found', async ({ page }) => {
  await logIn(page);
  await page.goto('/dashboard/customers/00000000-0000-4000-8000-000000000000/edit');
  await expect(page.getByText('Could not find the requested customer.')).toBeVisible();
  await page.goto('/dashboard/customers/not-a-uuid/edit');
  await expect(page.getByText('Could not find the requested customer.')).toBeVisible();
});
