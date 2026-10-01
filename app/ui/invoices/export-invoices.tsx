import { ArrowDownTrayIcon } from '@heroicons/react/20/solid';
import type { InvoiceStatusFilter } from '@/app/lib/schemas';

/** Downloads the invoice list as CSV, filtered as it is shown (search and status). */
export default function ExportInvoices({
  query,
  status,
}: {
  query: string;
  status: InvoiceStatusFilter | null;
}) {
  const params = new URLSearchParams();
  if (query) params.set('query', query);
  if (status) params.set('status', status);
  const search = params.toString();

  return (
    // A plain link (nothing to prefetch): the route answers with an attachment. No
    // `download` attribute, so an expired session shows the login page, not a file.
    <a
      href={`/dashboard/invoices/export${search ? `?${search}` : ''}`}
      className="flex h-10 flex-none items-center gap-2 rounded-xl border border-line px-3 text-sm font-medium text-aura transition-colors hover:border-aura hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plasma"
    >
      <ArrowDownTrayIcon className="h-5" />
      <span className="hidden md:block">Export CSV</span>
      <span className="sr-only md:hidden">Export CSV</span>
    </a>
  );
}
