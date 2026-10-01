'use client';

import { FunnelIcon } from '@heroicons/react/20/solid';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/**
 * Filters the invoice list by status, in the URL (`?status=`) beside the search,
 * like it: the search and the filter combine, and pagination keeps both.
 */
export default function StatusFilter() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();
  const current = searchParams.get('status') ?? '';

  const choose = (status: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', '1');
    if (status) params.set('status', status);
    else params.delete('status');
    replace(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="relative flex-none">
      <label htmlFor="status-filter" className="sr-only">
        Status
      </label>
      <select
        id="status-filter"
        value={['paid', 'pending'].includes(current) ? current : ''}
        onChange={(event) => choose(event.target.value)}
        className="block h-10 rounded-xl border border-line bg-panel py-2 pl-9 pr-8 text-sm text-white focus:border-aura focus:ring-aura"
      >
        <option value="">All statuses</option>
        <option value="paid">Paid</option>
        <option value="pending">Pending</option>
      </select>
      <FunnelIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-aura" />
    </div>
  );
}
