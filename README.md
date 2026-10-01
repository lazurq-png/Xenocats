# Xenocat Analytics

An invoices-and-customers dashboard, haunted by alien cats that go after your
cursor. Built with the Next.js App Router, PostgreSQL and Tailwind CSS.

- `/`: the landing page
- `/login`: sign in
- `/dashboard`: overview, invoices and customers (needs a session)
- `/cats`: every cat, with a button to summon it

## Development

```sh
npm ci
npm run dev
```

The app reads `POSTGRES_URL`, `AUTH_SECRET` and `AUTH_URL` from `.env`. The
checks (lint, type check, unit and browser tests, build) are listed in
`CLAUDE.md` §9.

## Design

The visual design comes from the Canva mockup "Xenocat Analytics website
mockup": a midnight background, lime and violet accents, Orbitron headings,
Montserrat on the public pages and Roboto in the dashboard. Its colours are
Tailwind tokens in `tailwind.config.ts` (`void`, `panel`, `line`, `plasma`,
`aura`, `cream`), its fonts are in `app/ui/fonts.tsx`, and its artwork (cats,
hero, logo marks, avatars) is in `public/xenocats/`.
