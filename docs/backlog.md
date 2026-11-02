# Backlog

Open questions and proposed work carried over from the night runs of
2026-09-25 to 2026-10-09, whose state directories were removed on 2026-10-17
(they are in git history, `docs/ai/night-<date>/`). Each was checked against
the code before it was written here. Newer runs' open items are in their own
`docs/ai/night-<date>/questions.md`.

Remove an entry when it is done or decided.

## Decisions for a human

### "Pending" means two things

The invoice list, its filter and the CSV split unpaid invoices into Pending (not
yet due) and Overdue. The dashboard's Pending card and chart, and the customers
table's Pending total, still add up every unpaid invoice, overdue included
(`fetchCardData` and the monthly totals in `app/lib/data.ts`). On the seed data
every unpaid invoice is overdue, so the list's Pending filter is empty while the
dashboard shows a Pending total.

- (a) Relabel those figures "Unpaid": the smallest change.
- (b) Show Overdue separately there too, as the list does.

### One time zone

The app dates an invoice by the UTC day (`createInvoice`, the create form's
default due date), while `CURRENT_DATE` (the overdue rule, "Due in N days") is
the day in the database session's time zone, which nothing sets. On a server not
on UTC they disagree for some hours a day: an invoice created then is "due in 29
(or 31) days", and dates near midnight land on the other side of "overdue".

- (a) Set `TimeZone: 'UTC'` on the app's `postgres` connections, so every
  "today" is the same. It touches every date the app reads.
- (b) Compute "today" in the app and pass it to the queries.

Undecided (2026-10-08): fix it in the dashboard or in the database.

### The demo login on the production database

`app/lib/placeholder-data.ts` seeds the Next.js course's demo login
(`user@nextmail.com`). `db:seed` refuses a public host, but nothing shows
whether the production (Neon) database was ever seeded from it before that
check existed. If it was, anyone who has read the course can log in there.
Check for that user on production, and remove it or change its password.

## Proposed tasks

### Drop `customers.image_url`

**First, check Neon:** the code that stops writing `image_url` reached `main`,
and so production, on 2026-10-23 (pull request #31, with migration 0012). It
inserts customers without an image, which the column's old `NOT NULL` refuses:
until 0012 is applied to the Neon database (`db:migrate`), every new customer
there fails. Nothing in the repository records whether it has been; Neon's
`schema_migrations` table does.

Nothing reads the column, and since migration 0012 nothing writes it: avatars are
drawn from the name. 0012 only made it optional, because `main` (what production
runs) still selected and inserted it then, and dropping it on a database `main`
uses would have broken the customer and invoice pages there. `main` no longer
names it; `Nightrun` (58af8cf, 2026-10-17), whose preview also uses Neon, still
does. Once every deployment that shares a database runs code without `image_url`
(production and previews on Neon), a migration
`ALTER TABLE customers DROP COLUMN image_url` finishes it.

### Login lockout: what it does not cover

`app/lib/login-limit.ts` locks an email after repeated failures. Not built:

- a limit per client address, so one source cannot try many emails;
- pruning `login_failures` rows of emails that never log in (an attacker adds
  one row per address they try).

### CI's database tests can pass with every test skipped

With the database tests opt-in, a CI step that lost `DATABASE_TESTS: '1'` (or
its `POSTGRES_URL`) would report green with every test skipped. A one-line
guard: fail the step if the Vitest summary shows nothing passed. Low urgency
(set aside 2026-10-08).

### An index for the searches

The invoice and customer searches match `ILIKE '%term%'`, which no B-tree index
can serve. A trigram index (`pg_trgm`, an extension created per database) would
serve the customers search; the invoice search's `OR` across a join would also
need restructuring (a `UNION` of the two sides, or one indexed text column).
Only worth it if the tables grow large.

## For a human to look at

Built and tested in a browser, but never seen on a real device or by eye:

- **Petting a sleeping cat on an iPhone.** A press held a second on a sleeping
  cat pets it; Chromium's touch emulation passes. On iOS a long press over text
  may start text selection or the callout instead. Summon a cat asleep on
  `/cats` and hold a finger on it. If iOS cancels it: `-webkit-touch-callout:
none` and `user-select: none` on the cat during a hold, or a hold shorter
  than the system's long press (about 500 ms).
- **Survival on a phone.** A phone sees at least 640 arena px across its
  narrower side (a 390 px phone zooms out 1.64), so every desktop window from
  650 px up is unzoomed. Whether the Keeper and cats are big enough to read is
  one constant, `ARENA_CONFIG.view` in `app/ui/xenocats/arena.ts`.
- **Art drawn in code** (canvas, no artwork): the Survival varieties and the
  Purring Cat, the Night Porter, the Housekeeper and the Neighbour's Cat, the
  chests, gems, shots and blades. A candidate for a design pass.
- **Balance.** Every Survival number began as a first guess. One seeded test
  checks that moving beats standing still; nothing checks that the five-minute
  goal can be reached by good play.
