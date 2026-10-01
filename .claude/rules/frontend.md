# Frontend Engineering Rules

Open this for frontend and UI work (components, styles, browser-facing state).

---

## Existing Design System

Before creating UI primitives, inspect the existing design system.

Reuse existing:

- buttons
- inputs
- modals
- dialogs
- cards
- tables
- menus
- typography
- layout primitives
- form components

Do not create duplicate primitives.

---

## Component Design

Keep components focused.

Prefer composition over giant components with many unrelated responsibilities.

Follow existing component boundaries.

Do not introduce a new component architecture for an isolated feature.

---

## State

Use the repository's existing state-management pattern.

Before introducing local/global state, determine:

- where the source of truth belongs
- whether the state can be derived
- whether server state already provides the value
- whether existing hooks/utilities solve the problem

Do not introduce a state-management dependency for a small isolated requirement.

---

## Data Fetching

Follow the existing data-fetching architecture.

Consider:

- loading
- success
- empty
- error
- retry
- stale data
- cancellation
- optimistic updates where relevant

Do not create ad-hoc fetch behavior when the application already has a standard mechanism.

---

## Accessibility

Preserve or improve:

- semantic HTML
- labels
- accessible names
- keyboard navigation
- focus behavior
- focus restoration
- error announcements
- disabled states
- appropriate ARIA usage

Do not use ARIA to compensate for avoidable semantic HTML problems.

---

## Responsive Behavior

For meaningful UI changes, consider:

- mobile
- tablet
- desktop
- long content
- empty states
- narrow containers
- keyboard interaction

Do not assume desktop-only behavior unless the product explicitly is desktop-only.

---

## This Repository's UI

- **Server Components by default.** Add `'use client'` only where a component
  needs state, effects or browser APIs (`search.tsx`, `nav-links.tsx`,
  `login-form.tsx` and the invoice forms are the existing examples), and keep it
  on the smallest component that needs it.
- **Primitives that already exist:** `app/ui/button.tsx`, the invoice
  `buttons.tsx` and `status.tsx`, `pagination.tsx`, `breadcrumbs.tsx`, the
  skeletons in `skeletons.tsx`, fonts in `fonts.tsx` (Orbitron `font-display`, Montserrat `font-sans`,
  Roboto `font-ui` for the dashboard), the logo in
  `xenocat-logo.tsx`, `customer-avatar.tsx`, and `@heroicons/react` (solid sets)
  for icons. Styling is Tailwind 3 utility classes (with `@tailwindcss/forms`)
  and `clsx` for conditional classes, using the colour tokens in
  `tailwind.config.ts` (`void`, `panel`, `line`, `plasma`, `aura`, `cream`) rather
  than raw Tailwind greys and blues. The site is dark-only and follows the Canva
  mockup "Xenocat Analytics website mockup"; its artwork is in `public/xenocats/`.
- **States use the App Router file conventions:** `loading.tsx` (with
  `<Suspense>` and a skeleton), `error.tsx`, and `not-found.tsx` with
  `notFound()`. Add a state the same way before inventing a component for it.
- **Search, filter and page state live in the URL** (`useSearchParams`,
  `usePathname`, `useRouter` in `search.tsx` and `pagination.tsx`), debounced
  with `use-debounce`. Follow that instead of adding client state.
- **Forms** post to Server Actions and show errors from the `useActionState`
  state the action returns. Keep the `aria-describedby` error regions the
  existing forms have.

---

## UI Verification

After significant UI work:

1. `npm run lint` and `npx next typegen && npx tsc --noEmit`
2. `npm test`, and `npm run test:e2e` with a Playwright test in `tests/e2e/`
   that performs the interaction the change affects
3. `npm run build`
4. start the application — `npm run dev` — and inspect the rendered UI in a
   browser, at phone and desktop width
5. test important interactions

Lint, type check and build prove the code compiles, not that anything renders
correctly, and none of them are UI evidence. A Playwright test proves an
interaction works; it does not prove the page looks right.

**Step 5 writes to the development database** in `.env` (schema `xenocats`). Its
data has no value, and `npm run db:reset` restores the seed data. Browser tests
use their own schema and may submit writing forms (`.claude/rules/testing.md`).

### Unattended: nobody can look

An unattended UI change is verified by steps 1–3 and a reviewer's reading, with
a browser test standing in for step 5. Report it as **tested in a browser, not
seen**, name what a human should look at, and never imply the UI was looked at.
Primarily visual changes are weak unattended work for that reason.

---

## Visual Consistency

Match existing:

- spacing
- typography
- colors
- borders
- shadows
- interaction states
- motion
- responsive behavior

Do not invent a second design language.

---

## Performance

Avoid unnecessary:

- rerenders
- expensive computations
- network requests
- large client bundles
- event listeners
- DOM work

Do not optimize prematurely.

Measure or identify a concrete reason before introducing complex optimization.
