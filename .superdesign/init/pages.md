# Pages

# Xenocat Analytics: Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 3.4 (+ @tailwindcss/forms), clsx, @heroicons/react (24/solid). No component library: custom primitives in `app/ui/`. Dark-only theme; fonts via next/font/google (Orbitron display, Montserrat sans, Roboto ui).

Dashboard pages also render inside `app/dashboard/layout.tsx` (tree under /dashboard). All pages render inside `app/layout.tsx`.

## (dashboard shell)
Shared dashboard layout
Entry: `app/dashboard/layout.tsx`
Dependencies:
- app/ui/dashboard/sidenav.tsx
  - app/ui/dashboard/nav-links.tsx
    - app/ui/dashboard/nav-styles.ts
  - app/ui/dashboard/nav-styles.ts (see above)
  - app/ui/xenocat-logo.tsx
  - auth.ts
    - auth.config.ts
    - app/lib/definitions.ts
- app/ui/xenocats/cat-layer.tsx
  - app/ui/xenocats/cat-engine.ts
    - app/ui/xenocats/cat-types.ts
      - app/ui/xenocats/effects.ts
        - app/ui/xenocats/random.ts
    - app/ui/xenocats/config.ts
    - app/ui/xenocats/effects.ts (see above)
    - app/ui/xenocats/random.ts (see above)
  - app/ui/xenocats/cat-art.ts
  - app/ui/xenocats/cat-sprite.tsx
    - app/ui/xenocats/cat-types.ts (see above)
  - app/ui/xenocats/cat-types.ts (see above)
  - app/ui/xenocats/config.ts (see above)
  - app/ui/xenocats/fake-cursor.tsx
    - app/ui/xenocats/cursor-controller.ts
      - app/ui/xenocats/effects.ts (see above)
      - app/ui/xenocats/random.ts (see above)
    - app/ui/xenocats/cursor-kind.ts
    - app/ui/xenocats/effects.ts (see above)
    - app/ui/xenocats/random.ts (see above)
- app/ui/xenocats/fake-cursor.tsx (see above)

## /
Public landing: hero with orbit art (HomeHero), logo, CTA to login.
Entry: `app/page.tsx`
Dependencies:
- app/ui/xenocat-logo.tsx
- app/ui/home-hero.tsx

## /login
Login card (LoginForm, credentials) over starry background.
Entry: `app/login/page.tsx`
Dependencies:
- app/ui/xenocat-logo.tsx
- app/ui/login-form.tsx
  - app/lib/actions.ts
    - auth.ts
      - auth.config.ts
      - app/lib/definitions.ts
    - app/lib/schemas.ts

## /cats
Public cat gallery: every alien cat with a Summon button (CatGallery).
Entry: `app/cats/page.tsx`
Dependencies:
- app/ui/xenocat-logo.tsx
- app/ui/xenocats/cat-gallery.tsx
  - app/ui/button.tsx
  - app/ui/xenocats/cat-layer.tsx
    - app/ui/xenocats/cat-engine.ts
      - app/ui/xenocats/cat-types.ts
        - app/ui/xenocats/effects.ts
          - app/ui/xenocats/random.ts
      - app/ui/xenocats/config.ts
      - app/ui/xenocats/effects.ts (see above)
      - app/ui/xenocats/random.ts (see above)
    - app/ui/xenocats/cat-art.ts
    - app/ui/xenocats/cat-sprite.tsx
      - app/ui/xenocats/cat-types.ts (see above)
    - app/ui/xenocats/cat-types.ts (see above)
    - app/ui/xenocats/config.ts (see above)
    - app/ui/xenocats/fake-cursor.tsx
      - app/ui/xenocats/cursor-controller.ts
        - app/ui/xenocats/effects.ts (see above)
        - app/ui/xenocats/random.ts (see above)
      - app/ui/xenocats/cursor-kind.ts
      - app/ui/xenocats/effects.ts (see above)
      - app/ui/xenocats/random.ts (see above)
  - app/ui/xenocats/cat-art.ts (see above)
  - app/ui/xenocats/cat-sprite.tsx (see above)
  - app/ui/xenocats/cat-types.ts (see above)
  - app/ui/xenocats/fake-cursor.tsx (see above)

## /dashboard
Overview: stat cards, revenue chart, latest invoices, range select.
Entry: `app/dashboard/(overview)/page.tsx`
Dependencies:
- app/ui/dashboard/revenue-chart.tsx
  - app/lib/data.ts
    - app/lib/definitions.ts
    - app/lib/utils.ts
    - app/lib/dashboard.ts
  - app/lib/dashboard.ts (see above)
  - app/lib/utils.ts (see above)
- app/ui/dashboard/latest-invoices.tsx
  - app/ui/customer-avatar.tsx
  - app/ui/invoices/status.tsx
  - app/lib/data.ts (see above)
  - app/lib/utils.ts (see above)
- app/ui/dashboard/range-select.tsx
  - app/lib/dashboard.ts (see above)
- app/ui/dashboard/cards.tsx
  - app/lib/data.ts (see above)
  - app/lib/dashboard.ts (see above)
  - app/lib/definitions.ts (see above)
  - app/lib/utils.ts (see above)
- app/ui/skeletons.tsx
- app/lib/dashboard.ts (see above)

## /dashboard/invoices
Invoice table with search + pagination + create button.
Entry: `app/dashboard/invoices/page.tsx`
Dependencies:
- app/ui/invoices/pagination.tsx
  - app/lib/utils.ts
- app/ui/search.tsx
- app/ui/invoices/table.tsx
  - app/ui/customer-avatar.tsx
  - app/ui/invoices/buttons.tsx
    - app/lib/actions.ts
      - auth.ts
        - auth.config.ts
        - app/lib/definitions.ts
      - app/lib/schemas.ts
  - app/ui/invoices/status.tsx
  - app/lib/utils.ts (see above)
  - app/lib/data.ts
    - app/lib/definitions.ts (see above)
    - app/lib/utils.ts (see above)
    - app/lib/dashboard.ts
- app/ui/invoices/buttons.tsx (see above)
- app/ui/skeletons.tsx
- app/lib/data.ts (see above)

## /dashboard/invoices/create
Create invoice form.
Entry: `app/dashboard/invoices/create/page.tsx`
Dependencies:
- app/ui/invoices/create-form.tsx
  - app/lib/definitions.ts
  - app/ui/button.tsx
  - app/lib/actions.ts
    - auth.ts
      - auth.config.ts
      - app/lib/definitions.ts (see above)
    - app/lib/schemas.ts
- app/ui/invoices/breadcrumbs.tsx
- app/lib/data.ts
  - app/lib/definitions.ts (see above)
  - app/lib/utils.ts
  - app/lib/dashboard.ts

## /dashboard/invoices/[id]/edit
Edit invoice form.
Entry: `app/dashboard/invoices/[id]/edit/page.tsx`
Dependencies:
- app/ui/invoices/edit-form.tsx
  - app/lib/definitions.ts
  - app/ui/button.tsx
  - app/lib/actions.ts
    - auth.ts
      - auth.config.ts
      - app/lib/definitions.ts (see above)
    - app/lib/schemas.ts
- app/ui/invoices/breadcrumbs.tsx
- app/lib/data.ts
  - app/lib/definitions.ts (see above)
  - app/lib/utils.ts
  - app/lib/dashboard.ts

## /dashboard/customers
Customers table.
Entry: `app/dashboard/customers/page.tsx`
Dependencies:
- (none)

