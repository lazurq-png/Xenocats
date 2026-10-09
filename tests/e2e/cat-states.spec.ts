import { type Page, expect, test } from '@playwright/test';
import { DEMO_USER } from './demo-user';

// The cat-themed not-found and empty states. Each shows its cat (decorative, so
// hidden from assistive technology), a heading, what happened, and a way on.
// The error state is a unit test (tests/unit/cat-error.test.tsx): it cannot be
// caused on purpose here.

/** The state's cat: an image of the given artwork, with no text alternative. */
async function expectCat(page: Page, artwork: string) {
  const cat = page.locator(`img[src*="${artwork}"]`).first();
  await expect(cat).toBeVisible();
  await expect(cat).toHaveAttribute('alt', '');
  await expect(cat).toHaveAttribute('aria-hidden', 'true');
}

test('an address the app does not have gets the cat 404, with a way home', async ({ page }) => {
  const response = await page.goto('/no-such-place');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1, name: '404 Not Found' })).toBeVisible();
  await expectCat(page, 'cat-sleeping');
  await page.getByRole('link', { name: 'Back to the home page' }).click();
  await expect(page).toHaveURL(/\/$/);
});

test.describe('logged in', () => {
  test.skip(!process.env.E2E_POSTGRES_URL, 'needs a database (POSTGRES_URL)');
  test.use({ storageState: DEMO_USER });

  test('an invoice that does not exist gets the cat 404, with a way back', async ({ page }) => {
    // An id that is not one gets the same.
    await page.goto('/dashboard/invoices/not-a-uuid');
    await expect(page.getByText('Could not find the requested invoice.')).toBeVisible();

    await page.goto('/dashboard/invoices/00000000-0000-4000-8000-000000000000');
    await expect(page.getByText('Could not find the requested invoice.')).toBeVisible();
    // The state is the whole page: its heading is the page's h1.
    await expect(page.getByRole('heading', { level: 1, name: '404 Not Found' })).toBeVisible();
    await expectCat(page, 'cat-sleeping');
    await page.getByRole('link', { name: 'Back to the invoices' }).click();
    await expect(page).toHaveURL(/\/dashboard\/invoices$/, { timeout: 15_000 });
  });

  test('a search that finds nothing says so, with a cat, in both lists', async ({ page }) => {
    const nothing = `nothing-${Date.now().toString(36)}`;
    await page.goto(`/dashboard/invoices?query=${nothing}`);
    await expect(page.getByRole('heading', { name: 'No invoices found' })).toBeVisible();
    await expectCat(page, 'cat-peek');
    await page.goto(`/dashboard/customers?query=${nothing}`);
    await expect(page.getByRole('heading', { name: 'No customers found' })).toBeVisible();
    await expectCat(page, 'cat-peek');
  });
});
