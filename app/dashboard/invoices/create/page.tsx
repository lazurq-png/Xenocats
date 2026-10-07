import Form from '@/app/ui/invoices/create-form';
import Breadcrumbs from '@/app/ui/invoices/breadcrumbs';
import { fetchCustomers } from '@/app/lib/data';
import { PAYMENT_DAYS, addDays } from '@/app/lib/schemas';
import { Metadata } from 'next';
import { connection } from 'next/server';

export const metadata: Metadata = {
  title: 'Create Invoice',
};

export default async function Page() {
  // Rendered per request, not once at build time: the customer list changes
  // whenever a customer is created, renamed or deleted.
  await connection();
  const customers = await fetchCustomers();
  // Dated today as the action dates it (UTC), due after the usual term.
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <Breadcrumbs
        breadcrumbs={[
          { label: 'Invoices', href: '/dashboard/invoices' },
          {
            label: 'Create Invoice',
            href: '/dashboard/invoices/create',
            active: true,
          },
        ]}
      />
      <Form customers={customers} dueDate={addDays(today, PAYMENT_DAYS)} />
    </div>
  );
}
