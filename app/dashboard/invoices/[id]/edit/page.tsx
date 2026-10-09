import Form from '@/app/ui/invoices/edit-form';
import Breadcrumbs from '@/app/ui/invoices/breadcrumbs';
import { fetchInvoiceById, fetchCustomers } from '@/app/lib/data';
import { InvoiceId } from '@/app/lib/schemas';
import { currentUserId } from '@/app/lib/session';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Edit Invoice',
};

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const id = params.id;
  const owner = await currentUserId();
  // Anything but a UUID names no invoice (and would be a database error); another
  // account's is as unknown as one that does not exist.
  const [invoice, customers] = await Promise.all([
    InvoiceId.safeParse(id).success ? fetchInvoiceById(owner, id) : undefined,
    fetchCustomers(owner),
  ]);

  if (!invoice) {
    notFound();
  }

  return (
    <div>
      <Breadcrumbs
        breadcrumbs={[
          { label: 'Invoices', href: '/dashboard/invoices' },
          {
            label: 'Edit Invoice',
            href: `/dashboard/invoices/${id}/edit`,
            active: true,
          },
        ]}
      />
      <Form invoice={invoice} customers={customers} />
    </div>
  );
}
