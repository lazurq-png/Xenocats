'use client';

import { CalendarIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { RANGES, parseRange } from '@/app/lib/dashboard';

/** The dashboard's period picker. The choice lives in the URL (`?range=`), like search and paging. */
export default function RangeSelect() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();
  const range = parseRange(searchParams.get('range') ?? undefined);

  return (
    <div className="relative w-full sm:w-[210px]">
      <label htmlFor="range" className="sr-only">
        Period
      </label>
      <CalendarIcon className="pointer-events-none absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-aura" />
      <select
        id="range"
        value={range}
        onChange={(e) => {
          const params = new URLSearchParams(searchParams);
          params.set('range', e.target.value);
          replace(`${pathname}?${params.toString()}`);
        }}
        className="h-[46px] w-full cursor-pointer appearance-none rounded-xl border border-line bg-panel-glass bg-none pl-12 pr-10 text-[14.7px] text-aura focus:border-aura focus:ring-aura"
      >
        {RANGES.map((r) => (
          <option key={r.value} value={r.value} className="bg-panel">
            {r.label}
          </option>
        ))}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-aura" />
    </div>
  );
}
