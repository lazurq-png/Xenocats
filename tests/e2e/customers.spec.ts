import postgres from 'postgres';
import { type Page, expect, test } from './fixtures';
import { DEMO_USER } from './demo-user';
import { users } from '@/app/lib/placeholder-data';

// Customer create, edit and delete, logged in as the demo user, against the test
// schema global-setup.ts rebuilds. Each test makes its own customer and asserts
// only on it, since the tests run in parallel on one schema. A form the action
// refuses, error by error, is tests/unit/forms.test.tsx.
test.skip(!process.env.E2E_POSTGRES_URL, 'needs a database (POSTGRES_URL)');
test.use({ storageState: DEMO_USER });

// After a submit or a link, allow for the next page still compiling under a busy
// next dev, which builds each route on its first visit (a first visit has run out
// of a shorter wait under the full suite).
const NAVIGATION = 15_000;

/** A customer name no other test (or run) uses. */
const unique = (what: string) =>
  `${what} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

async function createCustomer(page: Page, name: string, email: string) {
  await page.goto('/dashboard/customers/create');
  await page.getByLabel('Name').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Create customer' }).click();
  await expect(page).toHaveURL(/\/dashboard\/customers$/, { timeout: NAVIGATION });
}

/** The customer list, searched down to `name`. */
async function findCustomer(page: Page, name: string) {
  await page.goto(`/dashboard/customers?query=${encodeURIComponent(name)}`);
  return page.getByRole('row').filter({ hasText: name });
}

test('a customer is created, edited and deleted', async ({ page }) => {
  // Five page changes, each allowed NAVIGATION: more than the default 30 s in all.
  test.setTimeout(60_000);
  const name = unique('Orbital Snacks');
  const email = `${name.split(' ').pop()}@example.com`;
  await createCustomer(page, name, email);

  let row = await findCustomer(page, name);
  await expect(row).toHaveCount(1);
  await expect(row).toContainText(email);

  // Edit: the form shows the current values; the list shows the new ones.
  await row.getByRole('link', { name: `Edit ${name}` }).click();
  await expect(page).toHaveURL(/\/edit$/, { timeout: NAVIGATION });
  await expect(page.getByLabel('Name')).toHaveValue(name, { timeout: NAVIGATION });
  await expect(page.getByLabel('Email')).toHaveValue(email);
  const renamed = `${name} Ltd`;
  await page.getByLabel('Name').fill(renamed);
  await page.getByRole('button', { name: 'Save customer' }).click();
  await expect(page).toHaveURL(/\/dashboard\/customers$/, { timeout: NAVIGATION });
  row = await findCustomer(page, renamed);
  await expect(row).toHaveCount(1);

  // Delete: a customer without invoices goes.
  await row.getByRole('button', { name: `Delete ${renamed}` }).click();
  await expect(page.getByRole('row').filter({ hasText: renamed })).toHaveCount(0);
});

test('a customer who still has invoices cannot be deleted, and the list says why', async ({
  page,
}) => {
  const name = unique('Nebula Freight');
  await createCustomer(page, name, `${name.split(' ').pop()}@example.com`);

  // Give them an invoice.
  await page.goto('/dashboard/invoices/create');
  await page.getByLabel('Choose customer').selectOption({ label: name });
  await page.getByLabel('Choose an amount').fill('42');
  await page.getByLabel('Pending').check();
  await page.getByRole('button', { name: 'Create invoice' }).click();
  await expect(page).toHaveURL(/\/dashboard\/invoices$/, { timeout: NAVIGATION });

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
  await page.goto('/dashboard/customers/00000000-0000-4000-8000-000000000000/edit');
  await expect(page.getByText('Could not find the requested customer.')).toBeVisible();
  await page.goto('/dashboard/customers/not-a-uuid/edit');
  await expect(page.getByText('Could not find the requested customer.')).toBeVisible();
});

test('the list sorts by Total Paid, then the other way round, and the sort survives a reload', async ({
  page,
}) => {
  await page.goto('/dashboard/customers');
  const header = page.getByRole('columnheader', { name: 'Total Paid' });
  const button = header.getByRole('button', { name: 'Total Paid' });
  await expect(header).toHaveAttribute('aria-sort', 'none');
  await expect(page.getByRole('columnheader', { name: 'Name' })).toHaveAttribute(
    'aria-sort',
    'ascending'
  );
  /**
   * Each row's Total Paid, in cents, top to bottom (the desktop table). Visible rows only:
   * while the list streams in, React holds the new rows in a hidden copy as well, and
   * a read in that moment saw every customer twice (6 rows sorted, then the same 6).
   */
  const paid = () =>
    page
      .locator('table tbody tr')
      .filter({ visible: true })
      .evaluateAll((rows) =>
        rows.map((row) =>
          Math.round(Number(row.children[4].textContent!.replace(/[$,]/g, '')) * 100)
        )
      );

  // Other tests add customers meanwhile (the schema is shared): each read is checked on
  // its own, sorted its way, and the way turned round.
  const ascending = (cents: number[]) => cents.every((c, i) => i === 0 || cents[i - 1] <= c);
  const descending = (cents: number[]) => cents.every((c, i) => i === 0 || cents[i - 1] >= c);

  // A sort starts again from page 1.
  await button.click();
  await expect(page).toHaveURL(/[?&]sort=total_paid&dir=asc&page=1$/);
  await expect(header).toHaveAttribute('aria-sort', 'ascending');
  const up = await paid();
  expect(up.length).toBeGreaterThan(1);
  expect(ascending(up)).toBe(true);

  await button.click();
  await expect(page).toHaveURL(/[?&]sort=total_paid&dir=desc&page=1$/);
  await expect(header).toHaveAttribute('aria-sort', 'descending');
  await expect.poll(async () => descending(await paid())).toBe(true);
  const down = await paid();
  // The first page each way: the least paid, then the most. Customers other tests
  // make have paid nothing, so a page can be all $0 one way, never both.
  expect(up[0]).toBeLessThan(down[0]);

  await page.reload();
  await expect(header).toHaveAttribute('aria-sort', 'descending');
  const reloaded = await paid();
  expect(descending(reloaded)).toBe(true);
  expect(reloaded[0]).toBeGreaterThan(up[0]);
});

test('the list shows six customers a page, and pages through the rest', async ({ page }) => {
  // Seven customers of the demo user's, written straight into the schema, found by a
  // name only they have.
  const tag = unique('Pager');
  const sql = postgres(process.env.E2E_POSTGRES_URL!, { ssl: 'require', max: 1 });
  try {
    await sql`
      INSERT INTO customers (name, email, owner_id)
      SELECT ${tag} || ' ' || n, 'pager' || n || '@example.com', ${users[0].id}
      FROM generate_series(1, 7) AS n`;
    const rows = page.locator('table tbody tr').filter({ visible: true });

    await page.goto(`/dashboard/customers?query=${encodeURIComponent(tag)}`);
    await expect(rows).toHaveCount(6);
    await expect(rows.first()).toContainText(`${tag} 1`);

    await page.getByRole('link', { name: '2', exact: true }).click();
    await expect(page).toHaveURL(/[?&]page=2/);
    await expect(rows).toHaveCount(1);
    await expect(rows).toContainText(`${tag} 7`);
  } finally {
    await sql`DELETE FROM customers WHERE name LIKE ${`${tag} %`}`;
    await sql.end();
  }
});
