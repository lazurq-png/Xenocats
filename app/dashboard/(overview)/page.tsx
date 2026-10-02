import RevenueChart from '@/app/ui/dashboard/revenue-chart';
import LatestInvoices from '@/app/ui/dashboard/latest-invoices';
import RangeSelect from '@/app/ui/dashboard/range-select';
import { Suspense } from 'react';
import CardWrapper from '@/app/ui/dashboard/cards';
import { LatestInvoicesSkeleton, RevenueChartSkeleton, CardsSkeleton } from '@/app/ui/skeletons';
import { parseRange } from '@/app/lib/dashboard';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard',
};

export default async function Page(props: { searchParams?: Promise<{ range?: string }> }) {
  const range = parseRange((await props.searchParams)?.range);
  return (
    <div>
      <div className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1>
            <span className="block text-[20.8px] font-bold text-aura">Welcome back,</span>
            <span className="block font-display text-5xl font-black uppercase leading-[1.05] text-plasma md:text-[63px]">
              captain
            </span>
          </h1>
          <p className="mt-2 text-[17.2px] text-white">Here&apos;s your business at a glance.</p>
        </div>
        <RangeSelect />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Suspense key={range} fallback={<CardsSkeleton />}>
          <CardWrapper range={range} />
        </Suspense>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,537fr)_minmax(0,554fr)]">
        <Suspense key={range} fallback={<RevenueChartSkeleton />}>
          <RevenueChart range={range} />
        </Suspense>
        <Suspense fallback={<LatestInvoicesSkeleton />}>
          <LatestInvoices />
        </Suspense>
      </div>
    </div>
  );
}
