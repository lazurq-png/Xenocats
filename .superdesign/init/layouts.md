# Layouts

# Xenocat Analytics: Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 3.4 (+ @tailwindcss/forms), clsx, @heroicons/react (24/solid). No component library: custom primitives in `app/ui/`. Dark-only theme; fonts via next/font/google (Orbitron display, Montserrat sans, Roboto ui).

## RootLayout
- Path: `app/layout.tsx`
- Root html/body; applies font variables, font-sans, global.css.

```tsx
import '@/app/ui/global.css';
import { display, sans, ui } from '@/app/ui/fonts';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    template: '%s | Xenocat Analytics',
    default: 'Xenocat Analytics',
  },
  description: 'Invoices and customers at a glance, haunted by alien cats.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${ui.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
```

## Dashboard layout
- Path: `app/dashboard/layout.tsx`
- App shell: 228px SideNav + framed content area (rounded-bl-[40px], border-line); wraps cat + fake-cursor providers.

```tsx
import SideNav from '@/app/ui/dashboard/sidenav';
import { XenocatCatsProvider } from '@/app/ui/xenocats/cat-layer';
import { XenocatCursorProvider } from '@/app/ui/xenocats/fake-cursor';

/** The dashboard shell from the mockup's first page: the sidebar and a framed content area. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <XenocatCursorProvider>
      <XenocatCatsProvider>
        <div className="flex h-screen flex-col bg-void font-ui md:flex-row md:overflow-hidden">
          <div className="w-full flex-none md:w-[228px]">
            <SideNav />
          </div>
          <div className="grow md:overflow-y-auto">
            <div className="min-h-full px-4 py-6 md:rounded-bl-[40px] md:border-b md:border-l md:border-line/70 md:px-8 md:py-9">
              {children}
            </div>
          </div>
        </div>
      </XenocatCatsProvider>
    </XenocatCursorProvider>
  );
}
```

## SideNav
- Path: `app/ui/dashboard/sidenav.tsx`
- Sidebar: logo, nav links, sign-out (Server Action).

```tsx
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
```

## NavLinks
- Path: `app/ui/dashboard/nav-links.tsx`
- Client nav links with active state from usePathname.

```tsx
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
```

## nav-styles
- Path: `app/ui/dashboard/nav-styles.ts`
- Shared nav item class strings.

```ts
/** The rail's link look, shared by the nav links and the sign-out button. */
export const navLinkClass =
  'relative flex h-12 grow items-center justify-center gap-3 rounded-xl px-3 text-base font-bold text-aura transition-colors hover:bg-panel-raised/70 hover:text-white md:w-full md:flex-none md:justify-start md:px-4';
```
