import { auth } from '@/auth';
import { toCsv } from '@/app/lib/csv';
import { EXPORT_LIMIT, fetchInvoicesForExport } from '@/app/lib/data';
import { parseStatusFilter } from '@/app/lib/schemas';

// The invoice list as CSV, filtered as the list is (`?query=`, `?status=`).
// It checks the session itself: proxy.ts guards pages, but a route handler is an
// endpoint anyone can call directly.
export async function GET(request: Request) {
  const session = await auth();
  // The user's own invoices only: the id is the session's, never the request's.
  const owner = session?.user?.id;
  if (!owner) {
    return new Response('You must be logged in to export invoices.', {
      status: 401,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  const params = new URL(request.url).searchParams;
  const query = params.get('query') ?? '';
  const status = parseStatusFilter(params.get('status') ?? undefined);
  const invoices = await fetchInvoicesForExport(owner, query, status);
  // Never a file that looks complete but is not.
  if (invoices.length > EXPORT_LIMIT) {
    return new Response(
      `More than ${EXPORT_LIMIT.toLocaleString('en-US')} invoices match. Narrow the search or the status filter, then export again.`,
      { status: 422, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
    );
  }

  const csv = toCsv([
    ['Date', 'Due', 'Customer', 'Email', 'Amount', 'Status'],
    ...invoices.map((invoice) => [
      invoice.date,
      invoice.due_date,
      invoice.name,
      invoice.email,
      // Dollars with cents, as text: a spreadsheet reads it as a number.
      (invoice.amount / 100).toFixed(2),
      // As the list shows it: pending past its due date is overdue.
      invoice.status === 'pending' && invoice.overdue ? 'overdue' : invoice.status,
    ]),
  ]);

  // A byte-order mark, so Excel reads the file as UTF-8.
  return new Response(`\uFEFF${csv}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="invoices.csv"',
      'Cache-Control': 'no-store',
    },
  });
}
