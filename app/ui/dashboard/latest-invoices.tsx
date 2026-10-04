import CatState from '@/app/ui/cat-state';
import CustomerAvatar from '@/app/ui/customer-avatar';
import InvoiceStatus from '@/app/ui/invoices/status';
import { fetchLatestInvoices } from '@/app/lib/data';
import { formatDateToLocal } from '@/app/lib/utils';

/** A short reference for an invoice, from the start of its id. */
function invoiceRef(id: string) {
  return `INV-${id.slice(0, 4).toUpperCase()}`;
}

export default async function LatestInvoices() {
  const latestInvoices = await fetchLatestInvoices();

  return (
    <div data-xenocat-frame className="rounded-2xl border border-line bg-panel p-5">
      <h2 className="mb-6 text-[19.4px] font-bold text-white">Latest invoices</h2>
      <ul className="border-t border-line">
        {latestInvoices.map((invoice) => (
          <li
            key={invoice.id}
            className="grid grid-cols-[minmax(0,1fr)_76px_68px] items-center gap-3 border-b border-line py-3 text-[12.7px] text-aura sm:grid-cols-[minmax(0,1fr)_72px_84px_76px_68px]"
          >
            <div className="flex min-w-0 items-center gap-2">
              <CustomerAvatar name={invoice.name} size={28} />
              <span className="truncate">{invoice.name}</span>
            </div>
            <span className="hidden whitespace-nowrap text-[12.2px] sm:block">
              {invoiceRef(invoice.id)}
            </span>
            <span className="hidden whitespace-nowrap sm:block">
              {formatDateToLocal(invoice.date)}
            </span>
            <InvoiceStatus status={invoice.status} overdue={invoice.overdue} />
            <span className="text-right">{invoice.amount}</span>
          </li>
        ))}
      </ul>
      {latestInvoices.length === 0 && (
        <CatState art="empty" title="No invoices yet" as="h3">
          Invoices appear here as soon as one is created.
        </CatState>
      )}
    </div>
  );
}
