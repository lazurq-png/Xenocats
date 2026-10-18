import { Metadata } from 'next';
import CustomerForm from '@/app/ui/customers/customer-form';
import Breadcrumbs from '@/app/ui/breadcrumbs';

export const metadata: Metadata = {
  title: 'Create customer',
};

export default function Page() {
  return (
    <div>
      <Breadcrumbs
        breadcrumbs={[
          { label: 'Customers', href: '/dashboard/customers' },
          { label: 'Create customer', href: '/dashboard/customers/create', active: true },
        ]}
      />
      <CustomerForm />
    </div>
  );
}
