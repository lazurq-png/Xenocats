import { Metadata } from 'next';
import { Suspense } from 'react';
import { fetchCustomersPages } from '@/app/lib/data';
import { parseCustomerSort, parseSortDirection } from '@/app/lib/schemas';
import { currentUserId } from '@/app/lib/session';
import { parsePage } from '@/app/lib/utils';
import { CreateCustomer } from '@/app/ui/customers/buttons';
import CustomersTable from '@/app/ui/customers/table';
import Pagination from '@/app/ui/pagination';
import Search from '@/app/ui/search';
import { CustomersTableSkeleton } from '@/app/ui/skeletons';

export const metadata: Metadata = {
  title: 'Customers',
};

export default async function Page(props: {
  searchParams?: Promise<{ query?: string; page?: string; sort?: string; dir?: string }>;
}) {
  const searchParams = await props.searchParams;
  const query = searchParams?.query || '';
  const currentPage = parsePage(searchParams?.page);
  // A sort from the URL, from a fixed list of columns (anything else: by name).
  const sort = parseCustomerSort(searchParams?.sort);
  const dir = parseSortDirection(searchParams?.dir);
  const totalPages = await fetchCustomersPages(await currentUserId(), query);

  return (
    <div className="w-full">
      <h1 className="font-display text-3xl font-black uppercase text-plasma md:text-[40px]">
        Customers
      </h1>
      <div className="mt-4 flex items-center justify-between gap-2 md:mt-8">
        <Search placeholder="Search customers..." />
        <CreateCustomer />
      </div>
      <Suspense
        key={`${query}|${currentPage}|${sort}|${dir}`}
        fallback={<CustomersTableSkeleton />}
      >
        <CustomersTable query={query} currentPage={currentPage} sort={sort} dir={dir} />
      </Suspense>
      <div className="mt-5 flex w-full justify-center">
        <Pagination totalPages={totalPages} />
      </div>
    </div>
  );
}
