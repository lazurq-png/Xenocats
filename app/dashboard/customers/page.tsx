import { Metadata } from 'next';
import { fetchFilteredCustomers } from '@/app/lib/data';
import { CreateCustomer } from '@/app/ui/customers/buttons';
import CustomersTable from '@/app/ui/customers/table';
import Search from '@/app/ui/search';

export const metadata: Metadata = {
  title: 'Customers',
};

export default async function Page(props: { searchParams?: Promise<{ query?: string }> }) {
  const searchParams = await props.searchParams;
  const query = searchParams?.query || '';
  const customers = await fetchFilteredCustomers(query);

  return (
    <div className="w-full">
      <h1 className="font-display text-3xl font-black uppercase text-plasma md:text-[40px]">
        Customers
      </h1>
      <div className="mt-4 flex items-center justify-between gap-2 md:mt-8">
        <Search placeholder="Search customers..." />
        <CreateCustomer />
      </div>
      <CustomersTable customers={customers} />
    </div>
  );
}
