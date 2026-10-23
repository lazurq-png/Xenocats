import { ArrowLeftIcon } from '@heroicons/react/20/solid';
import clsx from 'clsx';
import Link from 'next/link';

/** The way back out of a page: an arrow and an underlined link, the same everywhere. */
export default function BackLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={clsx(
        'tap-area flex items-center gap-2 whitespace-nowrap border-b-2 border-aura-link/70 pb-1 text-[16.5px] font-semibold text-aura-link transition hover:border-aura hover:text-aura',
        className
      )}
    >
      <ArrowLeftIcon className="w-4" aria-hidden />
      {children}
    </Link>
  );
}
