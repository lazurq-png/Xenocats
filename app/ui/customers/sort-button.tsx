'use client';

import { ChevronDownIcon, ChevronUpDownIcon, ChevronUpIcon } from '@heroicons/react/20/solid';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { CustomerSort, SortDirection } from '@/app/lib/schemas';

/**
 * A column header of the customer list that sorts it: the first press sorts by this
 * column ascending, the next turns it round. The sort lives in the URL (`?sort=`,
 * `?dir=`), beside the search, as the page and status of the invoices do.
 */
export default function SortButton({
  column,
  label,
  sort,
  dir,
}: {
  column: CustomerSort;
  label: string;
  sort: CustomerSort;
  dir: SortDirection;
}) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();
  const active = sort === column;
  const Icon = !active ? ChevronUpDownIcon : dir === 'asc' ? ChevronUpIcon : ChevronDownIcon;

  const press = () => {
    const params = new URLSearchParams(searchParams);
    params.set('sort', column);
    params.set('dir', active && dir === 'asc' ? 'desc' : 'asc');
    replace(`${pathname}?${params.toString()}`);
  };

  return (
    <button
      type="button"
      onClick={press}
      className="inline-flex items-center gap-1 rounded font-medium hover:text-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-aura"
    >
      {label}
      <Icon aria-hidden="true" className={active ? 'h-4 w-4 text-plasma' : 'h-4 w-4'} />
    </button>
  );
}
