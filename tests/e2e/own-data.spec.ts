import bcryptjs from 'bcryptjs';
import postgres from 'postgres';
import { type Page, expect, test } from '@playwright/test';

// Each account sees only its own customers and invoices (migration 0005). A
// second user of the test's own, written straight into the test schema
// global-setup.ts rebuilds, opens the demo user's invoice and customer and gets
// the same not-found an unknown id gets; its lists and its export are empty.
test.skip(!process.env.E2E_POSTGRES_URL, 'needs a database (POSTGRES_URL)');

const PASSWORD = 'own-data-password-1';
const DEMO = '410544b2-4001-4271-9855-fec4b6a6442a';

/** A new user, and one of the demo user's invoices and customers. */
async function setUp() {
  const email = `own-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@example.com`;
  const sql = postgres(process.env.E2E_POSTGRES_URL!, { ssl: 'require', max: 1 });
  try {
    await sql`
      INSERT INTO users (name, email, password)
      VALUES ('Own Data Test', ${email}, ${await bcryptjs.hash(PASSWORD, 10)})`;
    const [invoice] = await sql<{ id: string; customer_id: string }[]>`
      SELECT invoices.id, invoices.customer_id FROM invoices
      JOIN customers ON invoices.customer_id = customers.id
      WHERE customers.owner_id = ${DEMO}
      -- The oldest, a seeded one: other specs add (and delete) only today's.
      ORDER BY invoices.date ASC, invoices.id
      LIMIT 1`;
    return { email, invoice: invoice.id, customer: invoice.customer_id };
  } finally {
    await sql.end();
  }
}

async function logIn(page: Page, email: string) {
  await page.goto('/login');
  // Filled before hydration, the form would be reset under the test's hands.
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: /log in/i }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
}

test("another account's invoices and customers are as if they did not exist", async ({ page }) => {
  test.setTimeout(90_000);
  const { email, invoice, customer } = await setUp();
  await logIn(page, email);

  // The demo user's invoice and customer, by their URLs: the same not-found as an
  // unknown id.
  await page.goto(`/dashboard/invoices/${invoice}`);
  await expect(page.getByText('Could not find the requested invoice.')).toBeVisible();
  await page.goto(`/dashboard/invoices/${invoice}/edit`);
  await expect(page.getByText('Could not find the requested invoice.')).toBeVisible();
  await page.goto(`/dashboard/customers/${customer}/edit`);
  await expect(page.getByText('Could not find the requested customer.')).toBeVisible();

  // Lists: nothing, not even with a search that matches the demo user's rows.
  await page.goto('/dashboard/invoices');
  await expect(page.getByText('No invoices found').filter({ visible: true })).toHaveCount(1);
  await page.goto('/dashboard/invoices?query=paid');
  await expect(page.getByText('No invoices found').filter({ visible: true })).toHaveCount(1);
  await page.goto('/dashboard/customers');
  await expect(page.getByText('No customers found')).toBeVisible();

  // The overview: no invoices, and nothing collected.
  await page.goto('/dashboard');
  await expect(page.getByText('No invoices yet')).toBeVisible();

  // The export: the header row and nothing else.
  const response = await page.request.get('/dashboard/invoices/export');
  expect(response.status()).toBe(200);
  const lines = (await response.text()).replace(/^﻿/, '').split('\r\n').filter(Boolean);
  expect(lines).toEqual(['Date,Due,Customer,Email,Amount,Status']);

  // The invoice form offers none of the demo user's customers.
  await page.goto('/dashboard/invoices/create');
  await expect(page.getByLabel('Choose customer').locator('option')).toHaveCount(1);
});
