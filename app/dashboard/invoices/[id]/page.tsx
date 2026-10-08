import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchInvoiceDetail } from '@/app/lib/data';
import { InvoiceId } from '@/app/lib/schemas';
import { dueText, formatCurrency, formatDateToLocal } from '@/app/lib/utils';
import CustomerAvatar from '@/app/ui/customer-avatar';
import { DeleteInvoice, UpdateInvoice } from '@/app/ui/invoices/buttons';
import Breadcrumbs from '@/app/ui/invoices/breadcrumbs';
import InvoiceStatus from '@/app/ui/invoices/status';

export const metadata: Metadata = {
  title: 'Invoice',
};

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  // Anything but a UUID names no invoice (and would be a database error).
  const invoice = InvoiceId.safeParse(id).success ? await fetchInvoiceDetail(id) : undefined;
  if (!invoice) notFound();

  const amount = formatCurrency(invoice.amount);
  const details = [
    ['Amount', amount],
    ['Date', formatDateToLocal(invoice.date)],
    ['Due', formatDateToLocal(invoice.due_date)],
    ['Customer email', invoice.email],
    ['Invoice number', invoice.id],
  ] as const;

  return (
    <div>
      <Breadcrumbs
        breadcrumbs={[
          { label: 'Invoices', href: '/dashboard/invoices' },
          { label: 'Invoice', href: `/dashboard/invoices/${id}`, active: true },
        ]}
      />
      <section
        aria-labelledby="invoice-heading"
        data-xenocat-frame
        className="rounded-2xl border border-line bg-panel p-4 md:p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CustomerAvatar name={invoice.name} size={40} />
            <div>
              <h1 id="invoice-heading" className="text-xl font-semibold text-white">
                {invoice.name}
              </h1>
              <p className="text-sm text-aura">Invoice</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <InvoiceStatus status={invoice.status} overdue={invoice.overdue} />
            <UpdateInvoice id={invoice.id} />
            <DeleteInvoice
              id={invoice.id}
              label={`invoice for ${invoice.name}, ${amount}`}
              fromDetailPage
            />
          </div>
        </div>
        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          {details.map(([term, value]) => (
            <div key={term} className="rounded-xl bg-void/60 p-4">
              <dt className="text-xs text-aura">{term}</dt>
              <dd className="mt-1 break-all text-base font-medium text-white">{value}</dd>
              {term === 'Due' && invoice.status === 'pending' && (
                <dd
                  data-testid="invoice-due-in"
                  className={
                    invoice.overdue ? 'mt-1 text-sm text-red-400' : 'mt-1 text-sm text-aura'
                  }
                >
                  {dueText(invoice.days_until_due)}
                </dd>
              )}
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
