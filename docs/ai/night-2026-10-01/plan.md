# Night run 2026-10-01

## Goal

Friday 08:30

## Limits

Information only. The run cannot see the account's usage limit; if it runs out,
the session stops, and the per-task commit and push bound the loss.

## Design decisions (made by the human; the run does not revisit them)

- **Order.** Tasks 1–4 first, then 5–24 as numbered.
- **Checkpoints.** After tasks 5, 10, 15 and 20, run the checkpoint below
  before starting the next task.
- **No new dependencies** anywhere tonight. Pointer lock and sound use browser
  APIs (`requestPointerLock`, Web Audio).
- **The cats' existing rules still hold** unless a task says otherwise: never
  more than 5 cats on screen, one effect at a time, the keyboard never affected,
  no off switch, cats and effects hidden from assistive technology.
- **The database** is the development one (`CLAUDE.md` §9). Browser tests may
  log in and write in `xenocats_test`. A test that changes a user (password,
  lockout) creates its own user; it never changes the demo user, which parallel
  tests log in as.
- **Migrations** are new files in `db/migrations/`, numbered in the order the
  tasks create them. The run never applies them to the `xenocats` schema; the
  e2e run's rebuild of `xenocats_test` is their test. List in `questions.md`
  that a human must run `npm run db:migrate`.
- **Superdesign is not used tonight.** No artwork generation.

## Checkpoint (after tasks 5, 10, 15 and 20)

A task like any other (`night-2026-10-01-c<N>-checkpoint`, through the whole of
§2), covering everything merged since the previous checkpoint:

1. **Tests.** Is every changed behaviour covered by a test that would fail
   without it? Is every test still relevant: no test of removed behaviour, no
   duplicate, no test that cannot fail? Add what is missing. A test that no
   longer tests anything relevant may be rewritten or removed, with the reason
   in `decisions.md`. *Explicitly lifts §3's "deleting a file you did not
   create" for test files under `tests/` only.*
2. **Quality and security.** Dispatch the `reviewer` on the range since the last
   checkpoint, with `.claude/rules/security-review.md` in scope. Fix every
   finding within the checkpoint, or record why not.
3. Append a `## Checkpoint <N>` entry to `progress.md`: what was checked, found
   and changed. Then continue with the next task.

## Tasks

1. **Fight a cat: Survival.** A "Fight" section on `/cats`. Clicking Start
   requests pointer lock (Esc ends the game); cats now attack the locked
   pointer itself, not a drawing of it. Cats arrive in waves of growing speed
   and frequency, still at most 5 at once. Each attack that lands costs one of 3
   lives; clicking a cat banishes it. Score = waves survived; the best score is
   kept in `localStorage`. Losing the lock (tab switch, blur) pauses the game.
   If pointer lock is refused or unavailable, the game runs with the normal
   fake cursor, and browser tests may use that path. The game logic (waves,
   lives, hits, scoring) is pure and unit-tested.

2. **Fight a cat: Taming.** A second mode beside Survival, with the same pointer
   lock and fallback. One cat at a time dodges the pointer; holding the pointer
   still on it for 2 s tames it. Tamed cats are saved in `localStorage` as a
   collection (task 5 shows it). Each cat type dodges in its own way, derived
   from its attack. Unit tests for the dodging and the 2-second rule.

3. **Cats attack page elements too.** Every attack also hits elements near the
   pointer: buttons, links, text, cards, table rows, inputs, centred on the
   pointer and reaching a radius set in the config module. Allowed: visual
   effects (shake, tilt, blur, flip, glow), temporary displacement, and
   scrambling or swapping visible text, each matched to the cat's attack. All
   of it reverts exactly when the effect ends: layout, content, attributes and
   focus as they were. Clicks stay blocked while elements are displaced, as
   they already are during an attack. Assistive technology keeps the real text
   throughout. Never touch the text or value of a field that has focus or is
   being typed in. Unit tests for target selection and exact restoration; e2e
   tests on `/cats` for a displaced element and a scrambled text restoring.

4. **Sound effects.** Synthesized with Web Audio: no audio files. A distinct
   sound for every cat's attack, plus waking up and spawning (arrival). A
   speaker toggle in a corner, on by default and remembered in `localStorage`;
   the toggle is keyboard reachable and labelled. Audio starts only after the
   first user gesture (browser autoplay rules) and fails silently where Web
   Audio is missing. Unit tests that every cat type has its sounds; an e2e test
   for the toggle.

5. **Cat field guide.** `/cats` shows, per cat type, stats kept in
   `localStorage`: times met, attacks survived, tamed (task 2). Empty-state
   wording for a new visitor.

6. **Pet a sleeping cat.** Hovering a sleeping cat for 1 s makes it purr (with a
   sound from task 4) and delays its wake-up. Clicking a sleeping cat wakes it
   early and angry: its attack is stronger by an amount set in the config.

7. **Cat combos.** Two cats waking close together, in place and time (both set
   in the config), fuse their attacks into one combined effect, e.g. Freeze +
   Bounce = an ice puck. At most one combo at a time, and it counts as the one
   active effect. Define at least 5 combos; unit-test each.

8. **Cats on touch devices.** Today cats run only with a precise pointer. On
   touch devices they appear and attack page elements only (task 3), centred on
   the last touch point. The fake cursor stays off. An e2e test with a touch
   device profile.

9. **Foreign keys and indexes.** Migration: `invoices.customer_id` references
   `customers(id)` `ON DELETE RESTRICT`; indexes for the invoice search, date
   sorting and status. Check that the seed data satisfies the key.

10. **Customer CRUD.** Create, edit and delete customers, following the invoice
    pattern: Server Actions validated with zod, `auth()` checked in each action,
    `useActionState` errors with `aria-describedby`. Deleting a customer who
    still has invoices is refused with a clear message (the key from task 9
    enforces it; the action reports it). E2E tests, each on its own customer.

11. **Invoice status filter.** Filter the invoice list by status in the URL,
    next to search, kept through pagination and combined with search.

12. **Invoice detail and delete confirmation.** An invoice detail page, and a
    confirmation dialog before deleting (an accessible dialog: focus trapped and
    restored, Esc cancels).

13. **CSV export.** Export the currently filtered invoice list as CSV through a
    route that checks `auth()` itself, with values escaped for spreadsheets
    (formula injection).

14. **Invoice due dates and overdue.** Migration adding a due date (existing
    rows get one derived from their date). "Overdue" is shown for unpaid
    invoices past their due date and is filterable (task 11). Seed data
    updated.

15. **E2E for invoice CRUD.** Browser tests that create, edit and delete an
    invoice, including validation errors, each on its own invoice.

16. **Database integration tests.** Vitest tests for every query in
    `app/lib/data.ts` against the test schema: search, pagination, totals,
    filters. Their own schema or rows, so they cannot collide with the e2e
    suite. Part of `npm test`, skipping without a database like the e2e ones.

17. **Login rate limiting.** After N failed logins for one email, refuse that
    email for M minutes (N and M in config). Stored in a new table (migration).
    The message does not reveal whether the email exists. Unit and e2e tests on
    a test-own email.

18. **Security headers.** Content-Security-Policy and the other standard
    headers in `next.config.ts`, compatible with Next, the cats' inline styles
    and Web Audio. E2E test that the headers are present and the pages still
    work.

19. **Change password.** A settings page where the logged-in user changes their
    password: current password required, new one validated, bcrypt. E2E on a
    test-own user.

20. **Last run's leftovers.** `git rm --cached next-env.d.ts` (it is already in
    `.gitignore`); `loading="eager"` (or the right priority) on the sidebar image
    that triggers the LCP warning; remove the stale `app/query/route.ts` mention
    from `CLAUDE.md` §9. *Explicitly lifts §3's "deleting a file you did not
    create" for untracking `next-env.d.ts` only.*

21. **Revenue from invoices.** The revenue chart reads the static `revenue`
    table. Compute it from the invoices instead, so new invoices show in the
    chart. Do not drop the table; propose that in `questions.md`.

22. **Cat 404, error and empty states.** Cat-themed not-found, error and "no
    results" states across the dashboard, using the existing artwork.

23. **Keyboard and accessibility pass.** Skip link, visible focus states,
    labelled controls, and browser tests that walk the dashboard and `/cats`
    by keyboard only.

24. **Cat intensity setting.** Calm / normal / chaos: how often cats come and
    how many at once (chaos still at most 5). No zero level. Remembered in
    `localStorage`.

25. **Exploration, until the goal time.** When tasks 1–24 are done, parked or
    abandoned, keep improving the project. *Explicitly lifts §6's "do not
    invent work" and §1.0's "work no task names is not built" for this task
    only.*
    - Each item is its own task (`night-2026-10-01-t25-<n>-<slug>`) through the
      whole of §2, merged like planned work.
    - Before starting an item, append to `progress.md` what it is, its kind
      and why it is worth doing.
    - Rotate between four kinds: new cat features, dashboard features, tests,
      security and quality. A security problem found at any point jumps the
      queue.
    - The checkpoint keeps running after every 5th item.
    - Nothing that needs a new dependency, Superdesign, or any database but the
      development one; those go to `questions.md`. None of §3's other rules are
      lifted.
