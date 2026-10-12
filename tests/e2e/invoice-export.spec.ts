import { expect, test } from './fixtures';
import { DEMO_USER } from './demo-user';

// The invoice list's CSV export link, and the export refused without a session.
// What the CSV holds (the filtered list, made safe for spreadsheets, as a download
// named invoices.csv) is tests/unit/export-route.test.ts and csv.test.ts, and the
// rows it reads are fetchInvoicesForExport in data.test.ts.
test.skip(!process.env.E2E_POSTGRES_URL, 'needs a database (POSTGRES_URL)');

test.describe('logged in', () => {
  test.use({ storageState: DEMO_USER });

  test('the Export link exports the list as filtered: its search and its status', async ({
    page,
  }) => {
    await page.goto('/dashboard/invoices?query=Amy&status=pending');
    await expect(page.getByRole('link', { name: 'Export CSV' })).toHaveAttribute(
      'href',
      '/dashboard/invoices/export?query=Amy&status=pending'
    );
  });
});

test('a visitor who is not logged in gets no CSV', async ({ request }) => {
  const response = await request.get('/dashboard/invoices/export', { maxRedirects: 0 });
  expect(response.headers()['content-type'] ?? '').not.toContain('text/csv');
  expect([302, 303, 307, 401]).toContain(response.status());
});
