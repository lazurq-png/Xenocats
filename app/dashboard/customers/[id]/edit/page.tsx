import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchCustomerById } from '@/app/lib/data';
import { currentUserId } from '@/app/lib/session';
import { CustomerId } from '@/app/lib/schemas';
import CustomerForm from '@/app/ui/customers/customer-form';
import Breadcrumbs from '@/app/ui/invoices/breadcrumbs';

export const metadata: Metadata = {
  title: 'Edit Customer',
};

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const owner = await currentUserId();
  // Anything but a UUID names no customer (and would be a database error); another
  // account's is as unknown as one that does not exist.
  const customer = CustomerId.safeParse(id).success
    ? await fetchCustomerById(owner, id)
    : undefined;
  if (!customer) notFound();

  return (
    <div>
      <Breadcrumbs
        breadcrumbs={[
          { label: 'Customers', href: '/dashboard/customers' },
          { label: 'Edit Customer', href: `/dashboard/customers/${id}/edit`, active: true },
        ]}
      />
      <CustomerForm customer={customer} />
    </div>
  );
}
