import CatState from '@/app/ui/cat-state';
import CustomerAvatar from '@/app/ui/customer-avatar';
import { DeleteInvoice, UpdateInvoice, ViewInvoice } from '@/app/ui/invoices/buttons';
import InvoiceStatus from '@/app/ui/invoices/status';
import { formatDateToLocal, formatCurrency } from '@/app/lib/utils';
import { fetchFilteredInvoices } from '@/app/lib/data';
import { currentUserId } from '@/app/lib/session';
import type { InvoiceStatusFilter } from '@/app/lib/schemas';

/** How an invoice is named to a screen reader: "invoice for Evil Rabbit, $666.00". */
const label = (invoice: { name: string; amount: number }) =>
  `invoice for ${invoice.name}, ${formatCurrency(invoice.amount)}`;

export default async function InvoicesTable({
  query,
  currentPage,
  status = null,
}: {
  query: string;
  currentPage: number;
  status?: InvoiceStatusFilter | null;
}) {
  const invoices = await fetchFilteredInvoices(await currentUserId(), query, currentPage, status);

  return (
    // Its own sideways scroll where the columns need more room than there is (as the
    // customers table): the page around it stays put.
    <div className="mt-6 flow-root overflow-x-auto">
      <div className="inline-block min-w-full align-middle">
        <div data-xenocat-frame className="rounded-2xl border border-line bg-panel p-2 md:pt-0">
          <div className="md:hidden">
            {invoices?.map((invoice) => (
              <div key={invoice.id} className="mb-2 w-full rounded-xl bg-void/60 p-4">
                <div className="flex items-center justify-between border-b border-line pb-4">
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <CustomerAvatar name={invoice.name} />
                      <p>{invoice.name}</p>
                    </div>
                    <p className="text-sm text-aura">{invoice.email}</p>
                  </div>
                  <InvoiceStatus status={invoice.status} overdue={invoice.overdue} />
                </div>
                <div className="flex w-full items-center justify-between pt-4">
                  <div>
                    <p className="text-xl font-semibold text-plasma">
                      {formatCurrency(invoice.amount)}
                    </p>
                    <p>{formatDateToLocal(invoice.date)}</p>
                    <p className="text-sm text-aura">Due {formatDateToLocal(invoice.due_date)}</p>
                  </div>
                  <div className="flex justify-end gap-2">
                    <ViewInvoice id={invoice.id} label={label(invoice)} />
                    <UpdateInvoice id={invoice.id} />
                    <DeleteInvoice id={invoice.id} label={label(invoice)} />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <table className="hidden min-w-full text-white md:table">
            <thead className="rounded-lg text-left text-sm font-normal text-aura">
              <tr>
                <th scope="col" className="px-4 py-5 font-medium sm:pl-6">
                  Customer
                </th>
                <th scope="col" className="px-3 py-5 font-medium">
                  Email
                </th>
                <th scope="col" className="px-3 py-5 font-medium">
                  Amount
                </th>
                <th scope="col" className="px-3 py-5 font-medium">
                  Date
                </th>
                <th scope="col" className="px-3 py-5 font-medium">
                  Due
                </th>
                <th scope="col" className="px-3 py-5 font-medium">
                  Status
                </th>
                <th scope="col" className="relative py-3 pl-6 pr-3">
                  <span className="sr-only">Edit</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-void/60">
              {invoices?.map((invoice) => (
                <tr
                  key={invoice.id}
                  className="w-full border-b border-line py-3 text-sm last-of-type:border-none [&:first-child>td:first-child]:rounded-tl-lg [&:first-child>td:last-child]:rounded-tr-lg [&:last-child>td:first-child]:rounded-bl-lg [&:last-child>td:last-child]:rounded-br-lg"
                >
                  <td className="whitespace-nowrap py-3 pl-6 pr-3">
                    <div className="flex items-center gap-3">
                      <CustomerAvatar name={invoice.name} />
                      <p>{invoice.name}</p>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">{invoice.email}</td>
                  <td className="whitespace-nowrap px-3 py-3">{formatCurrency(invoice.amount)}</td>
                  <td className="whitespace-nowrap px-3 py-3">{formatDateToLocal(invoice.date)}</td>
                  <td className="whitespace-nowrap px-3 py-3">
                    {formatDateToLocal(invoice.due_date)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <InvoiceStatus status={invoice.status} overdue={invoice.overdue} />
                  </td>
                  <td className="whitespace-nowrap py-3 pl-6 pr-3">
                    <div className="flex justify-end gap-3">
                      <ViewInvoice id={invoice.id} label={label(invoice)} />
                      <UpdateInvoice id={invoice.id} />
                      <DeleteInvoice id={invoice.id} label={label(invoice)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {invoices.length === 0 && (
            <CatState art="empty" title="No invoices found">
              No invoices to show here. If a search or a status is set, try another, or All
              statuses.
            </CatState>
          )}
        </div>
      </div>
    </div>
  );
}
