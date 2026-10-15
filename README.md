# Xenocat Analytics

An invoices-and-customers dashboard, haunted by alien cats that go after your
cursor. Built with the Next.js App Router, PostgreSQL and Tailwind CSS.

- `/`: the landing page
- `/login`: sign in
- `/dashboard`: overview, invoices and customers (needs a session)
- `/cats`: every cat, with a button to summon it
- `/cats/survival`: Survival, five minutes in an endless arena against the horde

## Development

```sh
npm ci
npm run dev
```

The app reads `POSTGRES_URL`, `AUTH_SECRET` and `AUTH_URL` from `.env`, and
optionally `LOGIN_MAX_FAILURES` and `LOGIN_LOCK_MINUTES`: after that many
failed logins in a row an email is refused for that many minutes (default 5
and 15). `SIGNUP_MAX_PER_DAY` caps the accounts made from one address a day
(default 2). The address is believed only from a proxy that sets it: on Vercel
`X-Real-IP`; elsewhere set `TRUSTED_PROXY_HEADER` to `x-real-ip` or
`x-forwarded-for` (the last entry), and only if the proxy in front of the app
overwrites that header. Without one, every client shares the one daily limit.
The checks (lint, type check, unit and browser tests, build) are listed in
`CLAUDE.md` §9.

## Design

The visual design comes from the Canva mockup "Xenocat Analytics website
mockup": a midnight background, lime and violet accents, Orbitron headings,
Montserrat on the public pages and Roboto in the dashboard. Its colours are
Tailwind tokens in the `@theme` block of `app/ui/global.css` (`void`, `panel`, `line`, `plasma`,
`aura`, `cream`), its fonts are in `app/ui/fonts.tsx`, and its artwork (cats,
hero, logo marks, avatars) is in `public/xenocats/`.
