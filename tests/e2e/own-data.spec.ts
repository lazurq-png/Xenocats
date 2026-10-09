import bcryptjs from 'bcryptjs';
import postgres from 'postgres';
import { type Page, expect, test } from './fixtures';

// Each account sees only its own customers and invoices (migration 0005). A
// second user of the test's own, written straight into the test schema
// global-setup.ts rebuilds, opens the demo user's invoice and customer and gets
// the same not-found an unknown id gets. That every list, count, total, search and
// export holds only the account's own rows is data.test.ts ("two accounts"); the
// pages showing them are not walked here as the other user: each passes the
// session's user to those queries, whose owner argument TypeScript requires.
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

/**
 * The visible copies of a text. While a Suspense boundary streams in, React holds
 * the new content in a hidden element beside the shown one for a moment, so a
 * plain getByText can match two (strict mode then fails), most often on a cold
 * `next dev` that compiles the page on its first visit.
 */
const seen = (page: Page, text: string) => page.getByText(text).filter({ visible: true });

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
  test.setTimeout(60_000);
  const { email, invoice, customer } = await setUp();
  await logIn(page, email);

  // The demo user's invoice and customer, by their URLs: the same not-found as an
  // unknown id.
  await page.goto(`/dashboard/invoices/${invoice}`);
  await expect(seen(page, 'Could not find the requested invoice.')).toHaveCount(1);
  await page.goto(`/dashboard/invoices/${invoice}/edit`);
  await expect(seen(page, 'Could not find the requested invoice.')).toHaveCount(1);
  await page.goto(`/dashboard/customers/${customer}/edit`);
  await expect(seen(page, 'Could not find the requested customer.')).toHaveCount(1);
});
