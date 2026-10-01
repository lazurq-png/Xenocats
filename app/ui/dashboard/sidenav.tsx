import Image from 'next/image';
import Link from 'next/link';
import NavLinks from '@/app/ui/dashboard/nav-links';
import { navLinkClass } from '@/app/ui/dashboard/nav-styles';
import XenocatLogo from '@/app/ui/xenocat-logo';
import { ArrowRightStartOnRectangleIcon } from '@heroicons/react/24/outline';
import { signOut } from '@/auth';

export default function SideNav() {
  return (
    <div className="relative flex h-full flex-col overflow-hidden border-line/80 bg-panel px-3 py-4 md:rounded-r-[28px] md:border md:border-l-0 md:px-4 md:pt-12">
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
            <div className="hidden md:block">Sign out</div>
          </button>
        </form>
      </div>
      {/* the rail's resident cat, watching from its console */}
      <Image
        src="/xenocats/cat-sidebar-console.webp"
        alt=""
        width={228}
        height={305}
        className="pointer-events-none absolute bottom-0 left-0 hidden w-full md:block"
      />
    </div>
  );
}
