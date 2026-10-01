# Components

# Xenocat Analytics: Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 3.4 (+ @tailwindcss/forms), clsx, @heroicons/react (24/solid). No component library: custom primitives in `app/ui/`. Dark-only theme; fonts via next/font/google (Orbitron display, Montserrat sans, Roboto ui).

## Button
- Path: `app/ui/button.tsx`
- Primary lime (plasma) pill button; spreads native button props.
- Props: children, className, ...ButtonHTMLAttributes

```tsx
import clsx from 'clsx';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export function Button({ children, className, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      className={clsx(
        'flex h-10 items-center rounded-xl bg-plasma px-4 text-sm font-semibold text-void transition hover:shadow-glow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plasma active:bg-plasma-dim aria-disabled:cursor-not-allowed aria-disabled:opacity-50',
        className
      )}
    >
      {children}
    </button>
  );
}
```

## CustomerAvatar
- Path: `app/ui/customer-avatar.tsx`
- Round customer image (next/image) with fallback.
- Props: see source

```tsx
import Image from 'next/image';

// The mockup's planet-and-symbol avatars (public/xenocats/avatar-1..5.webp).
const AVATARS = [1, 2, 3, 4, 5].map((n) => `/xenocats/avatar-${n}.webp`);

/**
 * A customer's avatar, chosen from the name so a customer always gets the same
 * one. It stands in for the stored `image_url`, whose files belonged to the
 * course this app started from.
 */
export default function CustomerAvatar({ name, size = 28 }: { name: string; size?: number }) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return (
    <span
      className="flex flex-none items-center justify-center overflow-hidden rounded-full bg-[#1a1c3a]"
      style={{ width: size, height: size }}
    >
      <Image
        src={AVATARS[hash % AVATARS.length]}
        alt={`${name}'s avatar`}
        width={size}
        height={size}
        className="h-full w-full object-contain"
      />
    </span>
  );
}
```

## XenocatLogo
- Path: `app/ui/xenocat-logo.tsx`
- Brand mark + "Xenocat Analytics" wordmark.
- Props: see source

```tsx
import clsx from 'clsx';
import Image from 'next/image';

/**
 * The Xenocat Analytics logo in the mockup's three treatments:
 * - `landing`: the lime cat-and-orbit mark, "Xenocat" in white, "Analytics" in lime;
 * - `login`: the violet cat mark and a larger wordmark, "Analytics" in violet;
 * - `dashboard`: the stacked Orbitron wordmark of the sidebar.
 */
export default function XenocatLogo({
  variant = 'landing',
  className,
}: {
  variant?: 'landing' | 'login' | 'dashboard';
  className?: string;
}) {
  if (variant === 'dashboard') {
    return (
      <p className={clsx('flex flex-col items-center font-display leading-none', className)}>
        <span className="text-[26px] font-black uppercase tracking-wide text-plasma">Xenocat</span>
        <span className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.5em] text-aura">
          Analytics
        </span>
      </p>
    );
  }

  const login = variant === 'login';
  return (
    <div
      className={clsx('flex items-center', login ? 'gap-3 sm:gap-5' : 'gap-2 sm:gap-3', className)}
    >
      <Image
        src={login ? '/xenocats/logo-mark-violet.webp' : '/xenocats/logo-mark-lime.webp'}
        alt=""
        width={login ? 58 : 50}
        height={login ? 57 : 49}
        priority
      />
      <p
        className={clsx(
          'flex items-baseline',
          login ? 'gap-3 sm:gap-5' : 'gap-2 sm:gap-7 md:gap-12'
        )}
      >
        <span
          className={clsx(
            'text-white',
            login
              ? 'text-3xl font-bold md:text-[43px]'
              : 'text-xl font-semibold tracking-tight sm:text-2xl md:text-[27.6px]'
          )}
        >
          Xenocat
        </span>
        <span
          className={clsx(
            login
              ? 'text-2xl font-bold text-aura-login md:text-[35px]'
              : 'text-sm font-semibold tracking-tight text-plasma sm:text-base md:text-[19px]'
          )}
        >
          Analytics
        </span>
      </p>
    </div>
  );
}
```

## Search
- Path: `app/ui/search.tsx`
- Client search input, URL-synced (?query), debounced.
- Props: placeholder

```tsx
'use client';

import { MagnifyingGlassIcon } from '@heroicons/react/20/solid';
import { useSearchParams, usePathname, useRouter } from 'next/navigation';
import { useDebouncedCallback } from 'use-debounce';

export default function Search({ placeholder }: { placeholder: string }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();

  const handleSearch = useDebouncedCallback((term) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', '1');
    if (term) {
      params.set('query', term);
    } else {
      params.delete('query');
    }
    replace(`${pathname}?${params.toString()}`);
  }, 300);

  return (
    <div className="relative flex flex-1 flex-shrink-0">
      <label htmlFor="search" className="sr-only">
        Search
      </label>
      <input
        id="search"
        className="peer block w-full rounded-xl border border-line bg-panel py-[9px] pl-10 text-sm text-white placeholder:text-aura/70 focus:border-aura focus:ring-aura"
        placeholder={placeholder}
        onChange={(e) => {
          handleSearch(e.target.value);
        }}
        defaultValue={searchParams.get('query')?.toString()}
      />
      <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-aura peer-focus:text-plasma" />
    </div>
  );
}
```

## CreateInvoice / UpdateInvoice / DeleteInvoice
- Path: `app/ui/invoices/buttons.tsx`
- Invoice action buttons/links.
- Props: id

```tsx
import { PencilIcon, PlusIcon, TrashIcon } from '@heroicons/react/20/solid';
import Link from 'next/link';
import { deleteInvoice } from '@/app/lib/actions';

export function CreateInvoice() {
  return (
    <Link
      href="/dashboard/invoices/create"
      className="flex h-10 items-center rounded-xl bg-plasma px-4 text-sm font-semibold text-void transition hover:shadow-glow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plasma"
    >
      <span className="hidden md:block">Create Invoice</span> <PlusIcon className="h-5 md:ml-4" />
    </Link>
  );
}

export function UpdateInvoice({ id }: { id: string }) {
  return (
    <Link
      href={`/dashboard/invoices/${id}/edit`}
      className="rounded-lg border border-line p-2 text-aura transition-colors hover:border-aura hover:text-white"
    >
      <span className="sr-only">Edit</span>
      <PencilIcon className="w-5" />
    </Link>
  );
}

export function DeleteInvoice({ id }: { id: string }) {
  const deleteInvoiceWithId = deleteInvoice.bind(null, id);

  return (
    <form action={deleteInvoiceWithId}>
      <button
        type="submit"
        className="rounded-lg border border-line p-2 text-aura transition-colors hover:border-red-400 hover:text-red-400"
      >
        <span className="sr-only">Delete</span>
        <TrashIcon className="w-5" />
      </button>
    </form>
  );
}
```

## InvoiceStatus
- Path: `app/ui/invoices/status.tsx`
- Pending/paid status badge.
- Props: status

```tsx
import clsx from 'clsx';

/** Paid: a lime outline pill. Pending: a filled violet pill. As in the mockup's invoice rows. */
export default function InvoiceStatus({ status }: { status: string }) {
  return (
    <span
      className={clsx(
        'inline-flex min-w-[52px] items-center justify-center rounded-full border px-3 py-1 text-[12.7px]',
        {
          'border-aura/60 bg-aura/25 text-white': status === 'pending',
          'border-plasma/70 text-plasma': status === 'paid',
        }
      )}
    >
      {status === 'pending' ? 'Pending' : null}
      {status === 'paid' ? 'Paid' : null}
    </span>
  );
}
```

## Pagination
- Path: `app/ui/invoices/pagination.tsx`
- URL-synced page links.
- Props: totalPages

```tsx
'use client';

import { ArrowLeftIcon, ArrowRightIcon } from '@heroicons/react/20/solid';
import clsx from 'clsx';
import Link from 'next/link';
import { generatePagination } from '@/app/lib/utils';
import { usePathname, useSearchParams } from 'next/navigation';

export default function Pagination({ totalPages }: { totalPages: number }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentPage = Number(searchParams.get('page')) || 1;

  const createPageURL = (pageNumber: number | string) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', pageNumber.toString());
    return `${pathname}?${params.toString()}`;
  };

  const allPages = generatePagination(currentPage, totalPages);

  return (
    <>
      <div className="inline-flex">
        <PaginationArrow
          direction="left"
          href={createPageURL(currentPage - 1)}
          isDisabled={currentPage <= 1}
        />

        <div className="flex -space-x-px">
          {allPages.map((page, index) => {
            let position: 'first' | 'last' | 'single' | 'middle' | undefined;

            if (index === 0) position = 'first';
            if (index === allPages.length - 1) position = 'last';
            if (allPages.length === 1) position = 'single';
            if (page === '...') position = 'middle';

            return (
              <PaginationNumber
                key={`${page}-${index}`}
                href={createPageURL(page)}
                page={page}
                position={position}
                isActive={currentPage === page}
              />
            );
          })}
        </div>

        <PaginationArrow
          direction="right"
          href={createPageURL(currentPage + 1)}
          isDisabled={currentPage >= totalPages}
        />
      </div>
    </>
  );
}

function PaginationNumber({
  page,
  href,
  isActive,
  position,
}: {
  page: number | string;
  href: string;
  position?: 'first' | 'last' | 'middle' | 'single';
  isActive: boolean;
}) {
  const className = clsx(
    'flex h-10 w-10 items-center justify-center text-sm border border-line text-aura',
    {
      'rounded-l-md': position === 'first' || position === 'single',
      'rounded-r-md': position === 'last' || position === 'single',
      'z-10 bg-plasma border-plasma text-void font-semibold': isActive,
      'hover:bg-panel hover:text-white': !isActive && position !== 'middle',
      'text-aura/50': position === 'middle',
    }
  );

  return isActive || position === 'middle' ? (
    <div className={className}>{page}</div>
  ) : (
    <Link href={href} className={className}>
      {page}
    </Link>
  );
}

function PaginationArrow({
  href,
  direction,
  isDisabled,
}: {
  href: string;
  direction: 'left' | 'right';
  isDisabled?: boolean;
}) {
  const className = clsx(
    'flex h-10 w-10 items-center justify-center rounded-md border border-line text-aura',
    {
      'pointer-events-none opacity-40': isDisabled,
      'hover:bg-panel hover:text-white': !isDisabled,
      'mr-2 md:mr-4': direction === 'left',
      'ml-2 md:ml-4': direction === 'right',
    }
  );

  const icon =
    direction === 'left' ? <ArrowLeftIcon className="w-4" /> : <ArrowRightIcon className="w-4" />;

  return isDisabled ? (
    <div className={className}>{icon}</div>
  ) : (
    <Link className={className} href={href}>
      {icon}
    </Link>
  );
}
```

## Breadcrumbs
- Path: `app/ui/invoices/breadcrumbs.tsx`
- Breadcrumb trail.
- Props: breadcrumbs: {label, href, active?}[]

```tsx
import { clsx } from 'clsx';
import Link from 'next/link';

interface Breadcrumb {
  label: string;
  href: string;
  active?: boolean;
}

export default function Breadcrumbs({ breadcrumbs }: { breadcrumbs: Breadcrumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6 block">
      <ol className={clsx('font-display', 'flex flex-wrap text-xl font-semibold md:text-2xl')}>
        {breadcrumbs.map((breadcrumb, index) => (
          <li
            key={breadcrumb.href}
            aria-current={breadcrumb.active}
            className={clsx(breadcrumb.active ? 'text-plasma' : 'text-aura hover:text-white')}
          >
            <Link href={breadcrumb.href}>{breadcrumb.label}</Link>
            {index < breadcrumbs.length - 1 ? (
              <span className="mx-3 inline-block text-line">/</span>
            ) : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}
```

## RangeSelect
- Path: `app/ui/dashboard/range-select.tsx`
- Dashboard date-range select (URL-synced).
- Props: see source

```tsx
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
```

## Skeletons
- Path: `app/ui/skeletons.tsx`
- Loading skeletons for cards, chart, tables, invoices.
- Props: none

```tsx
// Loading animation
const shimmer =
  'before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent';

export function CardSkeleton() {
  return (
    <div className={`${shimmer} relative overflow-hidden rounded-xl bg-panel p-2 shadow-sm`}>
      <div className="flex p-4">
        <div className="h-5 w-5 rounded-md bg-panel-raised" />
        <div className="ml-2 h-6 w-16 rounded-md bg-panel-raised text-sm font-medium" />
      </div>
      <div className="flex items-center justify-center truncate rounded-xl bg-void/60 px-4 py-8">
        <div className="h-7 w-20 rounded-md bg-panel-raised" />
      </div>
    </div>
  );
}

export function CardsSkeleton() {
  return (
    <>
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
    </>
  );
}

export function RevenueChartSkeleton() {
  return (
    <div className={`${shimmer} relative w-full overflow-hidden md:col-span-4`}>
      <div className="mb-4 h-8 w-36 rounded-md bg-panel" />
      <div className="rounded-xl bg-panel p-4">
        <div className="sm:grid-cols-13 mt-0 grid h-[410px] grid-cols-12 items-end gap-2 rounded-md bg-void/60 p-4 md:gap-4" />
        <div className="flex items-center pb-2 pt-6">
          <div className="h-5 w-5 rounded-full bg-panel-raised" />
          <div className="ml-2 h-4 w-20 rounded-md bg-panel-raised" />
        </div>
      </div>
    </div>
  );
}

export function InvoiceSkeleton() {
  return (
    <div className="flex flex-row items-center justify-between border-b border-line py-4">
      <div className="flex items-center">
        <div className="mr-2 h-8 w-8 rounded-full bg-panel-raised" />
        <div className="min-w-0">
          <div className="h-5 w-40 rounded-md bg-panel-raised" />
          <div className="mt-2 h-4 w-12 rounded-md bg-panel-raised" />
        </div>
      </div>
      <div className="mt-2 h-4 w-12 rounded-md bg-panel-raised" />
    </div>
  );
}

export function LatestInvoicesSkeleton() {
  return (
    <div className={`${shimmer} relative flex w-full flex-col overflow-hidden md:col-span-4`}>
      <div className="mb-4 h-8 w-36 rounded-md bg-panel" />
      <div className="flex grow flex-col justify-between rounded-xl bg-panel p-4">
        <div className="bg-void/60 px-6">
          <InvoiceSkeleton />
          <InvoiceSkeleton />
          <InvoiceSkeleton />
          <InvoiceSkeleton />
          <InvoiceSkeleton />
        </div>
        <div className="flex items-center pb-2 pt-6">
          <div className="h-5 w-5 rounded-full bg-panel-raised" />
          <div className="ml-2 h-4 w-20 rounded-md bg-panel-raised" />
        </div>
      </div>
    </div>
  );
}

export default function DashboardSkeleton() {
  return (
    <>
      <div className={`${shimmer} relative mb-4 h-8 w-36 overflow-hidden rounded-md bg-panel`} />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-4 lg:grid-cols-8">
        <RevenueChartSkeleton />
        <LatestInvoicesSkeleton />
      </div>
    </>
  );
}

export function TableRowSkeleton() {
  return (
    <tr className="w-full border-b border-line last-of-type:border-none [&:first-child>td:first-child]:rounded-tl-lg [&:first-child>td:last-child]:rounded-tr-lg [&:last-child>td:first-child]:rounded-bl-lg [&:last-child>td:last-child]:rounded-br-lg">
      {/* Customer Name and Image */}
      <td className="relative overflow-hidden whitespace-nowrap py-3 pl-6 pr-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-panel"></div>
          <div className="h-6 w-24 rounded bg-panel"></div>
        </div>
      </td>
      {/* Email */}
      <td className="whitespace-nowrap px-3 py-3">
        <div className="h-6 w-32 rounded bg-panel"></div>
      </td>
      {/* Amount */}
      <td className="whitespace-nowrap px-3 py-3">
        <div className="h-6 w-16 rounded bg-panel"></div>
      </td>
      {/* Date */}
      <td className="whitespace-nowrap px-3 py-3">
        <div className="h-6 w-16 rounded bg-panel"></div>
      </td>
      {/* Status */}
      <td className="whitespace-nowrap px-3 py-3">
        <div className="h-6 w-16 rounded bg-panel"></div>
      </td>
      {/* Actions */}
      <td className="whitespace-nowrap py-3 pl-6 pr-3">
        <div className="flex justify-end gap-3">
          <div className="h-[38px] w-[38px] rounded bg-panel"></div>
          <div className="h-[38px] w-[38px] rounded bg-panel"></div>
        </div>
      </td>
    </tr>
  );
}

export function InvoicesMobileSkeleton() {
  return (
    <div className="mb-2 w-full rounded-md bg-void/60 p-4">
      <div className="flex items-center justify-between border-b border-line pb-8">
        <div className="flex items-center">
          <div className="mr-2 h-8 w-8 rounded-full bg-panel"></div>
          <div className="h-6 w-16 rounded bg-panel"></div>
        </div>
        <div className="h-6 w-16 rounded bg-panel"></div>
      </div>
      <div className="flex w-full items-center justify-between pt-4">
        <div>
          <div className="h-6 w-16 rounded bg-panel"></div>
          <div className="mt-2 h-6 w-24 rounded bg-panel"></div>
        </div>
        <div className="flex justify-end gap-2">
          <div className="h-10 w-10 rounded bg-panel"></div>
          <div className="h-10 w-10 rounded bg-panel"></div>
        </div>
      </div>
    </div>
  );
}

export function InvoicesTableSkeleton() {
  return (
    <div className="mt-6 flow-root">
      <div className="inline-block min-w-full align-middle">
        <div className="rounded-lg border border-line bg-panel p-2 md:pt-0">
          <div className="md:hidden">
            <InvoicesMobileSkeleton />
            <InvoicesMobileSkeleton />
            <InvoicesMobileSkeleton />
            <InvoicesMobileSkeleton />
            <InvoicesMobileSkeleton />
            <InvoicesMobileSkeleton />
          </div>
          <table className="hidden min-w-full text-aura md:table">
            <thead className="rounded-lg text-left text-sm font-normal">
              <tr>
                <th scope="col" className="px-4 py-5 font-medium sm:pl-6">
                  Customer
                </th>
                <th scope="col" className="px-3 py-5 font-medium">
                  Email
                </th>
                <th scope="col" className="px-3 py-5 font-medium">
                  Amount
                </th>
                <th scope="col" className="px-3 py-5 font-medium">
                  Date
                </th>
                <th scope="col" className="px-3 py-5 font-medium">
                  Status
                </th>
                <th scope="col" className="relative pb-4 pl-3 pr-6 pt-2 sm:pr-6">
                  <span className="sr-only">Edit</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-void/60">
              <TableRowSkeleton />
              <TableRowSkeleton />
              <TableRowSkeleton />
              <TableRowSkeleton />
              <TableRowSkeleton />
              <TableRowSkeleton />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

## fonts
- Path: `app/ui/fonts.tsx`
- next/font definitions exposed as CSS variables.

```tsx
import { Montserrat, Orbitron, Roboto } from 'next/font/google';

// The mockup's three typefaces: Orbitron for display type, Montserrat for the
// public pages' copy, Roboto for the dashboard. Exposed as CSS variables that
// tailwind.config.ts maps to font-display, font-sans and font-ui.
export const display = Orbitron({ subsets: ['latin'], variable: '--font-display' });
export const sans = Montserrat({ subsets: ['latin'], variable: '--font-sans' });
export const ui = Roboto({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-ui',
});
```

## CAT_TYPES (cat roster)
- Path: `app/ui/xenocats/cat-types.ts`
- All 20 alien cats: name, palette {body, belly, glow, accent}, look {build, ears, pattern, antenna, eyes}, entrance/exit.

```ts
// The roster: each cat type pairs an attack effect with its look and its ways of
// arriving and leaving. Entrances and exits name CSS animations in global.css
// (`xenocat-enter-<name>` / `xenocat-exit-<name>`).

import {
  type Effect,
  axisLock,
  blur,
  bounce,
  decoys,
  delay,
  drift,
  drunk,
  fall,
  freeze,
  giant,
  heavy,
  jitter,
  knockback,
  magnet,
  orbit,
  reverse,
  spiral,
  teleport,
  tiny,
  vanish,
} from './effects';

export type CatPalette = {
  /** Fur. */
  body: string;
  /** Belly, inner ears and muzzle. */
  belly: string;
  /** Eyes, antenna tips and some markings. */
  glow: string;
  /** Stripes, points, patches and outline accents. */
  accent: string;
};

/** What the shared sprite draws for this cat (cat-sprite.tsx). */
export type CatLook = {
  build: 'sleek' | 'fluffy' | 'stocky';
  ears: 'pointed' | 'tufted' | 'folded' | 'big';
  pattern: 'none' | 'stripes' | 'spots' | 'patches' | 'points' | 'wrinkles' | 'frost' | 'stars';
  antenna: 'single' | 'double' | 'orb' | 'zigzag';
  eyes: 'slit' | 'round' | 'three' | 'spiral' | 'visor';
  /** A Manx has only a stub. */
  tail?: 'long' | 'stub';
};

export type CatType = {
  id: string;
  /** Its number in the plan's roster, 1–20. */
  number: number;
  name: string;
  effect: Effect;
  palette: CatPalette;
  look: CatLook;
  /** How it arrives: `xenocat-enter-<entrance>`. */
  entrance: string;
  entranceMs: number;
  /** How it leaves: `xenocat-exit-<exit>`. */
  exit: string;
  exitMs: number;
  /** Shakes the page as it arrives and leaves (Titan Forest Cat's stomp). */
  shake?: boolean;
};

export const CAT_TYPES: readonly CatType[] = [
  {
    id: 'void-tabby',
    number: 1,
    name: 'Void Tabby',
    effect: vanish,
    palette: { body: '#3b3552', belly: '#6d6590', glow: '#a78bfa', accent: '#16131f' },
    look: { build: 'sleek', ears: 'pointed', pattern: 'stripes', antenna: 'single', eyes: 'slit' },
    entrance: 'black-hole',
    entranceMs: 1000,
    exit: 'collapse',
    exitMs: 700,
  },
  {
    id: 'gravi-coon',
    number: 2,
    name: 'Gravi Coon',
    effect: heavy,
    palette: { body: '#8a6d4b', belly: '#d9c2a0', glow: '#fbbf24', accent: '#3f2f1f' },
    look: { build: 'fluffy', ears: 'tufted', pattern: 'stripes', antenna: 'double', eyes: 'round' },
    entrance: 'thud',
    entranceMs: 900,
    exit: 'sink',
    exitMs: 800,
  },
  {
    id: 'pulsar-siamese',
    number: 3,
    name: 'Pulsar Siamese',
    effect: knockback,
    palette: { body: '#efe6d8', belly: '#fffaf2', glow: '#38bdf8', accent: '#5b4636' },
    look: { build: 'sleek', ears: 'big', pattern: 'points', antenna: 'orb', eyes: 'slit' },
    entrance: 'pulse',
    entranceMs: 800,
    exit: 'pulse-out',
    exitMs: 600,
  },
  {
    id: 'mirror-sphynx',
    number: 4,
    name: 'Mirror Sphynx',
    effect: reverse,
    palette: { body: '#e8c9c1', belly: '#f7e3de', glow: '#c4b5fd', accent: '#8b6f68' },
    look: { build: 'sleek', ears: 'big', pattern: 'wrinkles', antenna: 'single', eyes: 'round' },
    entrance: 'mirror',
    entranceMs: 900,
    exit: 'shatter',
    exitMs: 700,
  },
  {
    id: 'static-calico',
    number: 5,
    name: 'Static Calico',
    effect: jitter,
    palette: { body: '#f5f0e6', belly: '#ffffff', glow: '#f59e0b', accent: '#262626' },
    look: { build: 'stocky', ears: 'pointed', pattern: 'patches', antenna: 'zigzag', eyes: 'slit' },
    entrance: 'static',
    entranceMs: 800,
    exit: 'static-out',
    exitMs: 700,
  },
  {
    id: 'cryo-persian',
    number: 6,
    name: 'Cryo Persian',
    effect: freeze,
    palette: { body: '#dbeafe', belly: '#f8fafc', glow: '#22d3ee', accent: '#3b82f6' },
    look: { build: 'fluffy', ears: 'folded', pattern: 'frost', antenna: 'orb', eyes: 'round' },
    entrance: 'crystal',
    entranceMs: 1000,
    exit: 'melt',
    exitMs: 900,
  },
  {
    id: 'nebula-ragdoll',
    number: 7,
    name: 'Nebula Ragdoll',
    effect: drift,
    palette: { body: '#4c3d75', belly: '#a78bda', glow: '#f0abfc', accent: '#2a1f47' },
    look: { build: 'fluffy', ears: 'pointed', pattern: 'stars', antenna: 'single', eyes: 'three' },
    entrance: 'condense',
    entranceMs: 1100,
    exit: 'dissipate',
    exitMs: 900,
  },
  {
    id: 'quantum-kitten',
    number: 8,
    name: 'Quantum Kitten',
    effect: teleport,
    palette: { body: '#99f6e4', belly: '#f0fdfa', glow: '#2dd4bf', accent: '#115e59' },
    look: { build: 'sleek', ears: 'big', pattern: 'none', antenna: 'double', eyes: 'three' },
    entrance: 'blink',
    entranceMs: 900,
    exit: 'blink-out',
    exitMs: 600,
  },
  {
    id: 'magneto-bengal',
    number: 9,
    name: 'Magneto Bengal',
    effect: magnet,
    palette: { body: '#e3a857', belly: '#fbe7c6', glow: '#ef4444', accent: '#4a2c12' },
    look: { build: 'sleek', ears: 'pointed', pattern: 'spots', antenna: 'orb', eyes: 'slit' },
    entrance: 'slide-edge',
    entranceMs: 900,
    exit: 'slide-off',
    exitMs: 800,
  },
  {
    id: 'orbit-abyssinian',
    number: 10,
    name: 'Orbit Abyssinian',
    effect: orbit,
    palette: { body: '#c0773f', belly: '#eecfa8', glow: '#fde047', accent: '#5c2f12' },
    look: { build: 'sleek', ears: 'big', pattern: 'stripes', antenna: 'orb', eyes: 'round' },
    entrance: 'spiral',
    entranceMs: 1100,
    exit: 'spiral-out',
    exitMs: 900,
  },
  {
    id: 'decoy-burmese',
    number: 11,
    name: 'Decoy Burmese',
    effect: decoys,
    palette: { body: '#5b3a29', belly: '#8c6a55', glow: '#facc15', accent: '#2b1a10' },
    look: { build: 'stocky', ears: 'pointed', pattern: 'none', antenna: 'double', eyes: 'round' },
    entrance: 'shadow-split',
    entranceMs: 900,
    exit: 'shadow-merge',
    exitMs: 800,
  },
  {
    id: 'wobble-fold',
    number: 12,
    name: 'Wobble Fold',
    effect: drunk,
    palette: { body: '#9ca3af', belly: '#e5e7eb', glow: '#fb923c', accent: '#374151' },
    look: { build: 'fluffy', ears: 'folded', pattern: 'stripes', antenna: 'zigzag', eyes: 'round' },
    entrance: 'tumble',
    entranceMs: 1000,
    exit: 'roll-away',
    exitMs: 900,
  },
  {
    id: 'munchkin-mite',
    number: 13,
    name: 'Munchkin Mite',
    effect: tiny,
    palette: { body: '#f9a8d4', belly: '#fdf2f8', glow: '#a3e635', accent: '#831843' },
    look: { build: 'stocky', ears: 'big', pattern: 'spots', antenna: 'single', eyes: 'round' },
    entrance: 'grow-dot',
    entranceMs: 800,
    exit: 'shrink',
    exitMs: 600,
  },
  {
    id: 'titan-forest-cat',
    number: 14,
    name: 'Titan Forest Cat',
    effect: giant,
    palette: { body: '#6b4f3a', belly: '#c8b39a', glow: '#84cc16', accent: '#2d1f14' },
    look: { build: 'fluffy', ears: 'tufted', pattern: 'patches', antenna: 'double', eyes: 'slit' },
    entrance: 'stomp',
    entranceMs: 900,
    exit: 'stomp-out',
    exitMs: 800,
    shake: true,
  },
  {
    id: 'lag-ragamuffin',
    number: 15,
    name: 'Lag Ragamuffin',
    effect: delay,
    palette: { body: '#e7dccb', belly: '#faf6ef', glow: '#60a5fa', accent: '#7c6a55' },
    look: { build: 'fluffy', ears: 'pointed', pattern: 'points', antenna: 'single', eyes: 'round' },
    entrance: 'slow-motion',
    entranceMs: 1800,
    exit: 'slow-fade',
    exitMs: 1600,
  },
  {
    id: 'gravity-manx',
    number: 16,
    name: 'Gravity Manx',
    effect: fall,
    palette: { body: '#a16207', belly: '#fde68a', glow: '#bef264', accent: '#422006' },
    look: {
      build: 'stocky',
      ears: 'pointed',
      pattern: 'none',
      antenna: 'orb',
      eyes: 'slit',
      tail: 'stub',
    },
    entrance: 'beam-down',
    entranceMs: 1300,
    exit: 'beam-up',
    exitMs: 1100,
  },
  {
    id: 'smoke-bombay',
    number: 17,
    name: 'Smoke Bombay',
    effect: blur,
    palette: { body: '#18181b', belly: '#3f3f46', glow: '#f97316', accent: '#000000' },
    look: { build: 'sleek', ears: 'pointed', pattern: 'none', antenna: 'single', eyes: 'round' },
    entrance: 'smoke',
    entranceMs: 1100,
    exit: 'poof',
    exitMs: 700,
  },
  {
    id: 'hypno-rex',
    number: 18,
    name: 'Hypno Rex',
    effect: spiral,
    palette: { body: '#c4b5fd', belly: '#ede9fe', glow: '#f472b6', accent: '#4c1d95' },
    look: { build: 'sleek', ears: 'big', pattern: 'none', antenna: 'orb', eyes: 'spiral' },
    entrance: 'eyes-first',
    entranceMs: 1400,
    exit: 'eyes-last',
    exitMs: 1200,
  },
  {
    id: 'pinball-devon',
    number: 19,
    name: 'Pinball Devon',
    effect: bounce,
    palette: { body: '#94a3b8', belly: '#e2e8f0', glow: '#22c55e', accent: '#1e293b' },
    look: { build: 'stocky', ears: 'big', pattern: 'stripes', antenna: 'zigzag', eyes: 'round' },
    entrance: 'bounce-in',
    entranceMs: 1100,
    exit: 'bounce-off',
    exitMs: 900,
  },
  {
    id: 'laser-ocicat',
    number: 20,
    name: 'Laser Ocicat',
    effect: axisLock,
    palette: { body: '#d6b98c', belly: '#f5ead6', glow: '#ef4444', accent: '#3b2a17' },
    look: { build: 'sleek', ears: 'pointed', pattern: 'spots', antenna: 'double', eyes: 'visor' },
    entrance: 'laser-in',
    entranceMs: 1000,
    exit: 'laser-out',
    exitMs: 800,
  },
];

export function catTypeById(id: string): CatType | undefined {
  return CAT_TYPES.find((type) => type.id === id);
}
```

## CatSprite
- Path: `app/ui/xenocats/cat-sprite.tsx`
- 72x72 SVG alien cat assembled from palette + look; uses raster art when available.
- Props: palette, look, pose: awake|asleep, size, art

```tsx
import type { CatLook, CatPalette } from './cat-types';

// A 72×72 alien cat in two poses, assembled from a cat type's `look`: its build,
// ears, coat pattern, antenna and eyes. `.xenocat-body` is what breathes while
// asleep; `.xenocat-glow` (antenna tips and eyes) pulses.

export const DEFAULT_LOOK: CatLook = {
  build: 'sleek',
  ears: 'pointed',
  pattern: 'stripes',
  antenna: 'single',
  eyes: 'slit',
};

export function CatSprite({
  palette,
  look = DEFAULT_LOOK,
  pose,
  size = 72,
  art,
}: {
  palette: CatPalette;
  look?: CatLook;
  pose: 'awake' | 'asleep';
  size?: number;
  /** Rendered artwork for this pose (cat-art.ts), drawn instead of the SVG. */
  art?: string;
}) {
  if (art) {
    // `.xenocat-body` keeps the breathing and staged-entrance hooks; awake, the
    // cat's glow colour pulses around it in place of the SVG's glowing parts.
    return (
      <span className="xenocat-body block" style={{ width: size, height: size }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- a sprite drawn at a fixed small size, not a content image */}
        <img
          src={art}
          alt=""
          width={size}
          height={size}
          draggable={false}
          className={pose === 'awake' ? 'xenocat-art-glow' : undefined}
          style={{ '--xenocat-glow': palette.glow } as React.CSSProperties}
        />
      </span>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" className="overflow-visible">
      {pose === 'asleep' ? (
        <Asleep palette={palette} look={look} />
      ) : (
        <Awake palette={palette} look={look} />
      )}
    </svg>
  );
}

type Parts = { palette: CatPalette; look: CatLook };

// ---------------------------------------------------------------- awake

function Awake({ palette: p, look }: Parts) {
  const fluffy = look.build === 'fluffy';
  const stocky = look.build === 'stocky';
  const body = fluffy ? { rx: 22, ry: 15 } : stocky ? { rx: 21, ry: 12.5 } : { rx: 19, ry: 14 };
  const headR = fluffy ? 16.5 : 15;
  return (
    <g className="xenocat-body">
      {/* tail */}
      <path
        d={look.tail === 'stub' ? 'M54 53 q5 -1 6 -5' : 'M54 54 C66 50 66 36 60 30'}
        fill="none"
        stroke={look.pattern === 'points' ? p.accent : p.body}
        strokeWidth={fluffy ? 9 : 6}
        strokeLinecap="round"
      />
      {/* body, belly, paws */}
      <ellipse cx="36" cy={stocky ? 53 : 51} rx={body.rx} ry={body.ry} fill={p.body} />
      <ellipse cx="36" cy="55" rx="10" ry="8" fill={p.belly} />
      <BodyPattern palette={p} look={look} />
      {[27, 45].map((x) => (
        <ellipse
          key={x}
          cx={x}
          cy="64"
          rx="5"
          ry="3"
          fill={look.pattern === 'points' ? p.accent : p.body}
          stroke={p.accent}
          strokeWidth="0.8"
        />
      ))}
      <Antenna palette={p} look={look} />
      <Ears palette={p} look={look} head={{ cx: 36, cy: 30, r: headR }} />
      {/* head */}
      {fluffy && (
        <path
          d="M20 30 l-3 3 l3 1 l-2 3 l4 0 M52 30 l3 3 l-3 1 l2 3 l-4 0"
          fill={p.body}
          stroke={p.body}
          strokeWidth="2"
        />
      )}
      <circle cx="36" cy="30" r={headR} fill={p.body} />
      <HeadPattern palette={p} look={look} />
      <ellipse cx="36" cy="36" rx="7" ry="5" fill={p.belly} />
      <Eyes palette={p} look={look} />
      {/* nose, mouth, whiskers */}
      <path d="M34.6 34.4 h2.8 l-1.4 1.8 z" fill={p.accent} />
      <path
        d="M36 36.2 q-1.6 2 -3.2 0.8 M36 36.2 q1.6 2 3.2 0.8"
        stroke={p.accent}
        strokeWidth="0.9"
        fill="none"
      />
      <path
        d="M26 35 l-7 -1.5 M26 37 l-7 1 M46 35 l7 -1.5 M46 37 l7 1"
        stroke={p.accent}
        strokeWidth="0.7"
        opacity="0.7"
      />
    </g>
  );
}

function Ears({ palette: p, look, head }: Parts & { head: { cx: number; cy: number; r: number } }) {
  const inner = look.pattern === 'points' ? p.accent : p.belly;
  switch (look.ears) {
    case 'big':
      return (
        <g>
          <path d="M20 26 L19 4 L34 17 Z" fill={p.body} />
          <path d="M52 26 L53 4 L38 17 Z" fill={p.body} />
          <path d="M22.5 21 L22 9 L30 16.5 Z" fill={inner} />
          <path d="M49.5 21 L50 9 L42 16.5 Z" fill={inner} />
        </g>
      );
    case 'folded':
      return (
        <g>
          <path d="M22 22 Q24 12 32 17 Q27 19 25 24 Z" fill={p.body} />
          <path d="M50 22 Q48 12 40 17 Q45 19 47 24 Z" fill={p.body} />
        </g>
      );
    case 'tufted':
      return (
        <g>
          <path d="M22 24 L24 8 L33 18 Z" fill={p.body} />
          <path d="M50 24 L48 8 L39 18 Z" fill={p.body} />
          <path d="M24.5 20 L25.5 12 L30 17 Z" fill={inner} />
          <path d="M47.5 20 L46.5 12 L42 17 Z" fill={inner} />
          <path
            d="M24 8 l-1 -5 M24 8 l1.5 -4.5 M48 8 l1 -5 M48 8 l-1.5 -4.5"
            stroke={p.accent}
            strokeWidth="1.2"
          />
        </g>
      );
    default:
      return (
        <g>
          <path d={`M22 ${head.cy - 6} L24 8 L33 18 Z`} fill={p.body} />
          <path d={`M50 ${head.cy - 6} L48 8 L39 18 Z`} fill={p.body} />
          <path d="M24.5 20 L25.5 12 L30 17 Z" fill={inner} />
          <path d="M47.5 20 L46.5 12 L42 17 Z" fill={inner} />
        </g>
      );
  }
}

function Antenna({ palette: p, look }: Parts) {
  switch (look.antenna) {
    case 'double':
      return (
        <g>
          <path d="M31 16 Q27 8 24 5" fill="none" stroke={p.accent} strokeWidth="1.5" />
          <path d="M41 16 Q45 8 48 5" fill="none" stroke={p.accent} strokeWidth="1.5" />
          <circle className="xenocat-glow" cx="24" cy="5" r="2.4" fill={p.glow} />
          <circle className="xenocat-glow" cx="48" cy="5" r="2.4" fill={p.glow} />
        </g>
      );
    case 'orb':
      return (
        <g>
          <path d="M36 16 L36 7" stroke={p.accent} strokeWidth="1.6" />
          <circle
            cx="36"
            cy="4"
            r="5.5"
            fill="none"
            stroke={p.glow}
            strokeWidth="0.8"
            opacity="0.6"
          />
          <circle className="xenocat-glow" cx="36" cy="4" r="3.6" fill={p.glow} />
        </g>
      );
    case 'zigzag':
      return (
        <g>
          <path d="M36 16 L33 12 L38 9 L34 5" fill="none" stroke={p.accent} strokeWidth="1.5" />
          <circle className="xenocat-glow" cx="34" cy="4" r="2.6" fill={p.glow} />
        </g>
      );
    default:
      return (
        <g>
          <path d="M36 16 Q34 9 38 4" fill="none" stroke={p.accent} strokeWidth="1.6" />
          <circle className="xenocat-glow" cx="38" cy="4" r="3" fill={p.glow} />
        </g>
      );
  }
}

function Eyes({ palette: p, look }: Parts) {
  if (look.eyes === 'visor') {
    return (
      <g className="xenocat-eyes">
        <rect x="23.5" y="25" width="25" height="8" rx="4" fill={p.accent} />
        <rect
          className="xenocat-glow"
          x="25"
          y="26.5"
          width="22"
          height="5"
          rx="2.5"
          fill={p.glow}
        />
        <path d="M27 29 h18" stroke="#ffffff" strokeWidth="0.8" opacity="0.8" />
      </g>
    );
  }
  if (look.eyes === 'spiral') {
    const swirl = (cx: number) =>
      `M${cx} 29 m0 -0.8 a0.8 0.8 0 1 1 -0.8 0.8 a1.8 1.8 0 1 1 1.8 1.8 a2.9 2.9 0 1 1 -2.9 -2.9 a3.9 3.9 0 1 1 3.9 3.9`;
    return (
      <g className="xenocat-eyes">
        {[30, 42].map((cx) => (
          <g key={cx}>
            <circle className="xenocat-glow" cx={cx} cy="29" r="5.2" fill={p.glow} />
            <path d={swirl(cx)} fill="none" stroke={p.accent} strokeWidth="1.1" />
          </g>
        ))}
      </g>
    );
  }
  const pupil = (cx: number) =>
    look.eyes === 'round' ? (
      <circle cx={cx} cy="29.5" r="2.4" fill={p.accent} />
    ) : (
      <ellipse cx={cx} cy="29" rx="1.3" ry="4.2" fill={p.accent} />
    );
  return (
    <g className="xenocat-eyes">
      {[30, 42].map((cx) => (
        <g key={cx}>
          <ellipse className="xenocat-glow" cx={cx} cy="29" rx="4.6" ry="5.6" fill={p.glow} />
          {pupil(cx)}
          <circle cx={cx + 1.4} cy="26.8" r="1.1" fill="#ffffff" />
        </g>
      ))}
      {look.eyes === 'three' && (
        <g>
          <ellipse className="xenocat-glow" cx="36" cy="21" rx="2.6" ry="3.2" fill={p.glow} />
          <ellipse cx="36" cy="21" rx="0.8" ry="2.4" fill={p.accent} />
        </g>
      )}
    </g>
  );
}

function HeadPattern({ palette: p, look }: Parts) {
  switch (look.pattern) {
    case 'spots':
      return (
        <Spots
          color={p.accent}
          at={[
            [29, 21],
            [43, 20],
            [36, 18],
          ]}
          r={1.3}
        />
      );
    case 'stripes':
      return (
        <path
          d="M30 17 q6 4 12 0 M29 20.5 q7 3 14 0"
          stroke={p.accent}
          strokeWidth="1.5"
          fill="none"
        />
      );
    case 'points':
      return <ellipse cx="36" cy="32" rx="9.5" ry="9" fill={p.accent} opacity="0.85" />;
    case 'patches':
      return <path d="M24 22 q5 -6 11 -4 q-2 6 -9 8 z" fill={p.glow} opacity="0.9" />;
    case 'wrinkles':
      return (
        <path
          d="M31 19 q5 2 10 0 M32 21.5 q4 1.5 8 0"
          stroke={p.accent}
          strokeWidth="0.9"
          fill="none"
          opacity="0.7"
        />
      );
    case 'frost':
      return (
        <Crystals
          color="#e0f2fe"
          at={[
            [27, 20],
            [45, 21],
          ]}
          size={2}
        />
      );
    case 'stars':
      return (
        <Stars
          color={p.glow}
          at={[
            [28, 20],
            [45, 22],
          ]}
        />
      );
    default:
      return null;
  }
}

function BodyPattern({ palette: p, look }: Parts) {
  switch (look.pattern) {
    case 'spots':
      return (
        <Spots
          color={p.accent}
          at={[
            [22, 47],
            [28, 42],
            [45, 43],
            [51, 49],
            [48, 57],
            [24, 56],
          ]}
          r={1.9}
        />
      );
    case 'stripes':
      return (
        <path
          d="M22 46 q3 -3 6 0 M44 46 q3 -3 6 0 M20 52 q3 -2 5 0 M47 52 q3 -2 5 0"
          stroke={p.accent}
          strokeWidth="1.6"
          fill="none"
        />
      );
    case 'patches':
      return (
        <g>
          <path d="M19 47 q4 -7 12 -4 q-1 8 -10 9 z" fill={p.accent} />
          <path d="M42 45 q7 -3 11 4 q-6 4 -11 1 z" fill={p.glow} opacity="0.9" />
        </g>
      );
    case 'wrinkles':
      return (
        <path
          d="M24 43 q3 2 6 0 M42 43 q3 2 6 0"
          stroke={p.accent}
          strokeWidth="0.9"
          fill="none"
          opacity="0.6"
        />
      );
    case 'frost':
      return (
        <Crystals
          color="#e0f2fe"
          at={[
            [22, 48],
            [49, 47],
            [30, 60],
          ]}
          size={2.4}
        />
      );
    case 'stars':
      return (
        <Stars
          color={p.glow}
          at={[
            [22, 47],
            [50, 49],
            [43, 58],
            [27, 58],
          ]}
        />
      );
    default:
      return null;
  }
}

/** Bengal-style rosettes: a ring with a darker centre. */
function Spots({ color, at, r }: { color: string; at: number[][]; r: number }) {
  return (
    <g>
      {at.map(([x, y]) => (
        <g key={`${x},${y}`}>
          <circle
            cx={x}
            cy={y}
            r={r * 1.5}
            fill="none"
            stroke={color}
            strokeWidth={r * 0.7}
            opacity="0.85"
          />
          <circle cx={x} cy={y} r={r * 0.6} fill={color} opacity="0.5" />
        </g>
      ))}
    </g>
  );
}

function Crystals({ color, at, size }: { color: string; at: number[][]; size: number }) {
  return (
    <g stroke={color} strokeWidth="1" strokeLinecap="round">
      {at.map(([x, y]) => (
        <path
          key={`${x},${y}`}
          d={`M${x - size} ${y} h${size * 2} M${x} ${y - size} v${size * 2} M${x - size * 0.7} ${
            y - size * 0.7
          } l${size * 1.4} ${size * 1.4} M${x + size * 0.7} ${y - size * 0.7} l${-size * 1.4} ${
            size * 1.4
          }`}
        />
      ))}
    </g>
  );
}

function Stars({ color, at }: { color: string; at: number[][] }) {
  return (
    <g fill={color}>
      {at.map(([x, y]) => (
        <path
          key={`${x},${y}`}
          className="xenocat-glow"
          d={`M${x} ${y - 2} l0.6 1.4 l1.4 0.6 l-1.4 0.6 l-0.6 1.4 l-0.6 -1.4 l-1.4 -0.6 l1.4 -0.6 z`}
        />
      ))}
    </g>
  );
}

// ---------------------------------------------------------------- asleep

function Asleep({ palette: p, look }: Parts) {
  const fluffy = look.build === 'fluffy';
  const earFill = look.pattern === 'points' ? p.accent : p.body;
  return (
    <g className="xenocat-body">
      {/* curled body */}
      <ellipse cx="38" cy="52" rx={fluffy ? 28 : 26} ry={fluffy ? 15 : 14} fill={p.body} />
      <AsleepPattern palette={p} look={look} />
      {/* tail wrapped round the front */}
      <path
        d={look.tail === 'stub' ? 'M62 52 q4 2 5 -2' : 'M62 54 C62 66 34 68 22 62'}
        fill="none"
        stroke={look.pattern === 'points' ? p.accent : p.body}
        strokeWidth={fluffy ? 9 : 6}
        strokeLinecap="round"
      />
      {/* ears */}
      {look.ears === 'folded' ? (
        <g>
          <path d="M14 42 Q15 34 21 38 Z" fill={earFill} />
          <path d="M32 40 Q31 33 26 37 Z" fill={earFill} />
        </g>
      ) : look.ears === 'big' ? (
        <g>
          <path d="M12 46 L10 28 L21 38 Z" fill={earFill} />
          <path d="M34 43 L34 27 L25 37 Z" fill={earFill} />
        </g>
      ) : (
        <g>
          <path d="M13 44 L14 31 L21 38 Z" fill={earFill} />
          <path d="M33 42 L31 30 L25 37 Z" fill={earFill} />
          {look.ears === 'tufted' && (
            <path d="M14 31 l-1 -4 M31 30 l1 -4" stroke={p.accent} strokeWidth="1.1" />
          )}
        </g>
      )}
      {/* head resting on the paws */}
      <circle cx="23" cy="47" r={fluffy ? 13 : 12} fill={p.body} />
      {look.pattern === 'points' && (
        <ellipse cx="23" cy="49" rx="8" ry="7" fill={p.accent} opacity="0.85" />
      )}
      <ellipse cx="23" cy="51" rx="6" ry="4" fill={p.belly} />
      {/* drooping antenna(e), dimmed */}
      {look.antenna === 'double' ? (
        <g>
          <path d="M19 36 Q17 29 12 29" fill="none" stroke={p.accent} strokeWidth="1.4" />
          <path d="M27 36 Q30 29 35 30" fill="none" stroke={p.accent} strokeWidth="1.4" />
          <circle cx="12" cy="29" r="2" fill={p.glow} opacity="0.45" />
          <circle cx="35" cy="30" r="2" fill={p.glow} opacity="0.45" />
        </g>
      ) : (
        <g>
          <path d="M23 35 Q27 28 33 30" fill="none" stroke={p.accent} strokeWidth="1.5" />
          <circle
            cx="33"
            cy="30"
            r={look.antenna === 'orb' ? 3.4 : 2.4}
            fill={p.glow}
            opacity="0.45"
          />
        </g>
      )}
      {/* closed eyes */}
      <path
        d="M16.5 46 q2.5 2 5 0 M24.5 46 q2.5 2 5 0"
        stroke={p.accent}
        strokeWidth="1.3"
        fill="none"
        strokeLinecap="round"
      />
      {look.eyes === 'three' && (
        <path d="M21.4 41 q1.6 1.2 3.2 0" stroke={p.accent} strokeWidth="1.1" fill="none" />
      )}
      <path d="M21.8 49.6 h2.4 l-1.2 1.4 z" fill={p.accent} />
    </g>
  );
}

function AsleepPattern({ palette: p, look }: Parts) {
  switch (look.pattern) {
    case 'spots':
      return (
        <Spots
          color={p.accent}
          at={[
            [38, 43],
            [47, 41],
            [55, 46],
            [44, 56],
            [56, 55],
          ]}
          r={1.9}
        />
      );
    case 'stripes':
      return (
        <path
          d="M34 41 q4 -4 8 0 M46 43 q4 -4 8 0 M40 57 q3 -3 6 0"
          stroke={p.accent}
          strokeWidth="1.6"
          fill="none"
        />
      );
    case 'patches':
      return (
        <g>
          <path d="M36 42 q7 -5 13 0 q-5 6 -13 3 z" fill={p.accent} />
          <path d="M50 52 q6 -4 10 2 q-5 5 -10 2 z" fill={p.glow} opacity="0.9" />
        </g>
      );
    case 'wrinkles':
      return (
        <path
          d="M38 44 q3 2 6 0 M48 46 q3 2 6 0"
          stroke={p.accent}
          strokeWidth="0.9"
          fill="none"
          opacity="0.6"
        />
      );
    case 'frost':
      return (
        <Crystals
          color="#e0f2fe"
          at={[
            [40, 45],
            [53, 48],
            [47, 58],
          ]}
          size={2.4}
        />
      );
    case 'stars':
      return (
        <Stars
          color={p.glow}
          at={[
            [40, 44],
            [52, 47],
            [46, 57],
            [58, 55],
          ]}
        />
      );
    default:
      return null;
  }
}
```

## CAT_ART
- Path: `app/ui/xenocats/cat-art.ts`
- Raster artwork per cat/pose (public/xenocats/cats/<id>-<pose>.webp, 512x512 transparent, made in Canva).

```ts
// Rendered artwork for the cats, generated with Canva in the style of the site's
// mockup (public/xenocats/cats/<id>-<pose>.webp, 512×512, transparent). A cat
// without artwork for a pose is drawn by the SVG sprite in cat-sprite.tsx.
//
// The generation plan, prompts and keying script live outside the repo, in the
// Canva reference folder (cats/plan.json, cats/key.js); add a pose here once its
// file is in public/xenocats/cats/. Hypno Rex's eyes-first entrance fades in
// `.xenocat-eyes` before the body, so its artwork will need an eyes overlay.

export type Pose = 'awake' | 'asleep';

export const CAT_ART: Readonly<Record<string, Partial<Record<Pose, string>>>> = {
  'void-tabby': { awake: '/xenocats/cats/void-tabby-awake.webp' },
  'gravi-coon': { awake: '/xenocats/cats/gravi-coon-awake.webp' },
  'pulsar-siamese': { awake: '/xenocats/cats/pulsar-siamese-awake.webp' },
};

/**
 * The artwork for a cat's pose, if there is any. With `wholeSet`, only when the
 * cat has artwork for both poses, so a cat never switches style between sleeping
 * and waking up (the on-screen cats do both; the gallery shows them awake only).
 */
export function catArt(id: string, pose: Pose, { wholeSet = false } = {}): string | undefined {
  const art = CAT_ART[id];
  if (!art) return undefined;
  if (wholeSet && !(art.awake && art.asleep)) return undefined;
  return art[pose];
}
```
