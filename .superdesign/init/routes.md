# Routes

# Xenocat Analytics: Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 3.4 (+ @tailwindcss/forms), clsx, @heroicons/react (24/solid). No component library: custom primitives in `app/ui/`. Dark-only theme; fonts via next/font/google (Orbitron display, Montserrat sans, Roboto ui).

File-based routing (Next.js App Router). `proxy.ts` + `auth.config.ts` require a session for `/dashboard/**`. Layouts: `root` = app/layout.tsx; `dashboard` = app/layout.tsx > app/dashboard/layout.tsx. State files: `app/dashboard/(overview)/loading.tsx`, `app/dashboard/invoices/error.tsx`, `app/dashboard/invoices/[id]/edit/not-found.tsx`.

| URL | File | Layout | Renders |
|---|---|---|---|
| `/` | `app/page.tsx` | root | Public landing: hero with orbit art (HomeHero), logo, CTA to login. |
| `/login` | `app/login/page.tsx` | root | Login card (LoginForm, credentials) over starry background. |
| `/cats` | `app/cats/page.tsx` | root | Public cat gallery: every alien cat with a Summon button (CatGallery). |
| `/dashboard` | `app/dashboard/(overview)/page.tsx` | dashboard | Overview: stat cards, revenue chart, latest invoices, range select. |
| `/dashboard/invoices` | `app/dashboard/invoices/page.tsx` | dashboard | Invoice table with search + pagination + create button. |
| `/dashboard/invoices/create` | `app/dashboard/invoices/create/page.tsx` | dashboard | Create invoice form. |
| `/dashboard/invoices/[id]/edit` | `app/dashboard/invoices/[id]/edit/page.tsx` | dashboard | Edit invoice form. |
| `/dashboard/customers` | `app/dashboard/customers/page.tsx` | dashboard | Customers table. |

## Auth gate

```ts
import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith('/dashboard');
      // The public cat gallery: open to everyone, and logged-in users stay on it.
      const isOnCats = nextUrl.pathname === '/cats' || nextUrl.pathname.startsWith('/cats/');
      if (isOnCats) return true;
      if (isOnDashboard) {
        if (isLoggedIn) return true;
        return false; // Redirect unauthenticated users to login page
      } else if (isLoggedIn) {
        return Response.redirect(new URL('/dashboard', nextUrl));
      }
      return true;
    },
  },
  providers: [], // Add providers with an empty array for now
} satisfies NextAuthConfig;
```

```ts
import NextAuth from 'next-auth';
import { authConfig } from './auth.config';

export default NextAuth(authConfig).auth;

export const config = {
  // https://nextjs.org/docs/app/api-reference/file-conventions/proxy#matcher
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'],
};
```
