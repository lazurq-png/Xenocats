import Pagination from '@/app/ui/invoices/pagination';
import Search from '@/app/ui/search';
import Table from '@/app/ui/invoices/table';
import { CreateInvoice } from '@/app/ui/invoices/buttons';
import { InvoicesTableSkeleton } from '@/app/ui/skeletons';
import { Suspense } from 'react';
import { fetchInvoicesPages } from '@/app/lib/data';
import { parsePage } from '@/app/lib/utils';
import { Metadata } from 'next';
import { parseStatusFilter } from '@/app/lib/schemas';
import StatusFilter from '@/app/ui/invoices/status-filter';
import ExportInvoices from '@/app/ui/invoices/export-invoices';

export const metadata: Metadata = {
  title: 'Invoices',
};

export default async function Page(props: {
  searchParams?: Promise<{
    query?: string;
    page?: string;
    status?: string;
  }>;
}) {
  const searchParams = await props.searchParams;
  const query = searchParams?.query || '';
  const currentPage = parsePage(searchParams?.page);
  // Anything but a known status shows them all.
  const status = parseStatusFilter(searchParams?.status);
  const totalPages = await fetchInvoicesPages(query, status);

  return (
    <div className="w-full">
      <div className="flex w-full items-center justify-between">
        <h1 className="font-display text-3xl font-black uppercase text-plasma md:text-[40px]">
          Invoices
        </h1>
      </div>
      <div className="mt-4 flex items-center justify-between gap-2 md:mt-8">
        <Search placeholder="Search invoices..." />
        <StatusFilter />
        <ExportInvoices query={query} status={status} />
        <CreateInvoice />
      </div>
      <Suspense key={`${query}|${currentPage}|${status}`} fallback={<InvoicesTableSkeleton />}>
        <Table query={query} currentPage={currentPage} status={status} />
      </Suspense>
      <div className="mt-5 flex w-full justify-center">
        <Pagination totalPages={totalPages} />
      </div>
    </div>
  );
}
