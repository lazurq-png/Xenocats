'use client';

import { DocumentTextIcon, HomeIcon } from '@heroicons/react/24/outline';
import { UserGroupIcon } from '@heroicons/react/24/solid';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { navLinkClass } from '@/app/ui/dashboard/nav-styles';

const links = [
  { name: 'Home', href: '/dashboard', icon: HomeIcon },
  { name: 'Invoices', href: '/dashboard/invoices', icon: DocumentTextIcon },
  { name: 'Customers', href: '/dashboard/customers', icon: UserGroupIcon },
];

export default function NavLinks() {
  const pathname = usePathname();
  return (
    <>
      {links.map((link) => {
        const LinkIcon = link.icon;
        const active =
          link.href === '/dashboard' ? pathname === link.href : pathname.startsWith(link.href);
        return (
          <Link
            key={link.name}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={clsx(navLinkClass, {
              'bg-panel-raised text-plasma hover:text-plasma': active,
            })}
          >
            {/* the lime bar on the rail's edge that marks the current page */}
            {active && (
              <span className="absolute -left-4 top-1/2 hidden h-12 w-1.5 -translate-y-1/2 rounded-r-full bg-plasma shadow-[0_0_14px_rgba(193,232,56,0.7)] md:block" />
            )}
            <LinkIcon className="w-7" />
            <p className="hidden md:block">{link.name}</p>
          </Link>
        );
      })}
    </>
  );
}
