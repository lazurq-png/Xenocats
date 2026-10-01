# Extractable components

# Xenocat Analytics: Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 3.4 (+ @tailwindcss/forms), clsx, @heroicons/react (24/solid). No component library: custom primitives in `app/ui/`. Dark-only theme; fonts via next/font/google (Orbitron display, Montserrat sans, Roboto ui).

## Layout components

## SideNav
- Source: `app/ui/dashboard/sidenav.tsx` (+ `nav-links.tsx`, `nav-styles.ts`)
- Category: layout
- Description: Dashboard sidebar (228px on md+, top bar on mobile): Xenocat logo, Home/Invoices/Customers links, sign-out
- Extractable props: activeItem (string: "home" | "invoices" | "customers", default "home")
- Hardcoded: logo, link labels, heroicons, all classes

## DashboardShell
- Source: `app/dashboard/layout.tsx`
- Category: layout
- Description: bg-void page with sidebar + framed content area (border-l/border-b line, rounded-bl-[40px])
- Extractable props: none
- Hardcoded: layout classes

## PublicHeader
- Source: `app/cats/page.tsx` (header element), `app/page.tsx`
- Category: layout
- Description: Logo on the left, violet underlined text link on the right, over starfield
- Extractable props: linkLabel (string), linkHref (string)
- Hardcoded: XenocatLogo, classes

## Basic components

## Button
- Source: `app/ui/button.tsx`
- Category: basic
- Description: Lime plasma pill button
- Extractable props: label (string), disabled (boolean, default false)
- Hardcoded: classes

## InvoiceStatus
- Source: `app/ui/invoices/status.tsx`
- Category: basic
- Description: Paid / pending badge
- Extractable props: status ("paid" | "pending", default "pending")
- Hardcoded: icons, colors

## Search
- Source: `app/ui/search.tsx`
- Category: basic
- Description: Search input with magnifier icon
- Extractable props: placeholder (string)
- Hardcoded: icon, classes

## Breadcrumbs
- Source: `app/ui/invoices/breadcrumbs.tsx`
- Category: basic
- Description: Breadcrumb trail with active last item
- Extractable props: items (label/href list), activeIndex (number)
- Hardcoded: separator, classes

## Pagination
- Source: `app/ui/invoices/pagination.tsx`
- Category: basic
- Description: Previous / numbered / next page links
- Extractable props: currentPage (number, default 1), totalPages (number, default 5)
- Hardcoded: arrows, classes

## CustomerAvatar
- Source: `app/ui/customer-avatar.tsx`
- Category: basic
- Description: Round customer avatar
- Extractable props: name (string), imageUrl (string)
- Hardcoded: size, ring classes

## CatCard
- Source: `app/ui/xenocats/cat-gallery.tsx` (roster item) + `cat-sprite.tsx` / `cat-art.ts`
- Category: basic
- Description: One alien cat card: artwork/sprite, name, number, what it does, Summon button
- Extractable props: catName (string), catNumber (number), artSrc (string)
- Hardcoded: layout, button style
