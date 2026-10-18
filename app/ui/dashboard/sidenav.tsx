import Image from 'next/image';
import Link from 'next/link';
import NavLinks from '@/app/ui/dashboard/nav-links';
import { navLinkClass } from '@/app/ui/dashboard/nav-styles';
import XenocatLogo from '@/app/ui/xenocat-logo';
import { ArrowRightStartOnRectangleIcon } from '@heroicons/react/24/outline';
import { signOut } from '@/auth';

export default function SideNav() {
  return (
    <div
      data-xenocat-frame
      className="relative flex h-full flex-col overflow-hidden border-line/80 bg-panel px-3 py-4 md:rounded-r-[28px] md:border md:border-l-0 md:px-4 md:pt-12"
    >
      <Link className="mb-4 flex justify-center rounded-xl p-2 md:mb-12" href="/">
        <XenocatLogo variant="dashboard" />
      </Link>
      <div className="relative z-10 flex flex-row justify-between gap-2 md:flex-col md:gap-1.5">
        <NavLinks />
        <hr className="hidden border-line md:my-4 md:block" />
        <form
          className="flex grow md:grow-0"
          action={async () => {
            'use server';
            await signOut({ redirectTo: '/' });
          }}
        >
          <button className={navLinkClass}>
            <ArrowRightStartOnRectangleIcon className="w-7" />
            <div className="sr-only md:not-sr-only">Sign out</div>
          </button>
        </form>
      </div>
      {/* The rail's resident cat, watching from its console. In the column's flow,
          under the links: on a short screen it is cut off at the bottom rather than
          climbing over Sign out. The negative margins span the rail's padding. */}
      <Image
        src="/xenocats/cat-sidebar-console.webp"
        alt=""
        width={228}
        height={305}
        // In view on every dashboard page from the start, and often its largest image
        // (Next flags it as the LCP): load it at once rather than lazily.
        loading="eager"
        className="pointer-events-none -mx-4 -mb-4 mt-auto hidden w-[calc(100%+2rem)] max-w-none shrink-0 pt-4 md:block"
      />
    </div>
  );
}
