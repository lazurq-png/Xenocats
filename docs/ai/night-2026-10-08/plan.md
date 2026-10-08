# Night run 2026-10-08

## Goal

Friday 07:00

## Limits

Information only. The run cannot see the account's usage limit; if it runs out,
the session pauses until the timer's next firing after it resets, and the
per-task commit and push bound the loss.

## Design decisions (made by the human; the run does not revisit them)

- **Focus.** Tonight is the Survival game, the cats, and bugs. Outside them,
  only tasks 10–12. No other dashboard features.
- **Order.** Tasks 1–5, checkpoint 1, tasks 6–12, checkpoint 2, then
  exploration (`## Exploration`) until the goal time. Task 12 (sign-up) never
  merges before task 11 (each account's own data): if task 11 is abandoned or
  parked, task 12 is parked too.
- **Dependencies.** A task whose prerequisite (named in the task) was abandoned
  or parked is parked too (§4), with the reason in `progress.md`; the run goes
  on with the next task that does not depend on it.
- **Databases.** Only the development server in `.env` (a private address), and
  on it only what the skill allows: the browser tests' `xenocats_test`, the
  database tests' `xenocats_vitest`, and `xenocats` read by the build. Never a
  write to `xenocats`, never `npm run db:*`. Task 11 adds a migration
  (`db/migrations/0005_*.sql`): the browser tests, the database tests and CI
  apply it to their own schemas; the run never applies it to `xenocats`. A
  human runs `npm run db:migrate` in the morning, so the report must say that
  the development app's dashboard needs it.
- **No new dependencies.** The game stays on the browser's Canvas 2D API. Task 9
  uses `sharp`, which is already installed (Next.js brings it).
- **No Superdesign.** The 20 cat types' artwork changes only as task 9 says.
  The Survival game's own SVG art (`arena-art.ts`) may be added to and changed.
- **The cats' existing rules still hold** outside the Survival game: never more
  than 5 cats on screen, one effect at a time, the keyboard never affected, no
  off switch, cats and effects hidden from assistive technology, every page
  effect reverts exactly.
- **Settled questions** from the 2026-10-07 run, not to be reopened: Q2 (clicks
  are never blocked), Q11 (weapons may target the Neighbour's Cat). Q1, Q5, Q7
  and Q12 are a human's and are not worked on tonight.

## Checkpoint (after task 5, after task 12, then after every 5th exploration item)

A task like any other (`night-2026-10-08-c<N>-checkpoint`, through the whole of
§2), covering everything merged since the previous checkpoint:

1. **Tests.** Is every changed behaviour covered by a test that would fail
   without it? Is every test still relevant: no test of removed behaviour, no
   duplicate, no test that cannot fail? Add what is missing. A test that no
   longer tests anything relevant may be rewritten or removed, with the reason
   in `decisions.md`. _Explicitly lifts §3's "deleting a file you did not
   create" for test files under `tests/` only._
2. **Quality and security.** Dispatch the `reviewer` on the range since the last
   checkpoint, with `.claude/rules/security-review.md` in scope. Fix every
   finding within the checkpoint, or record why not.
3. Append a `## Checkpoint <N>` entry to `progress.md`: what was checked, found
   and changed. Then continue with the next task.

## Tasks

1. **Taming is removed; `/cats` has one Play button.** The "Fight a cat"
   section on `/cats` (`cat-gallery.tsx`) becomes a single **Play** link to
   `/cats/survival`, and its text describes Survival only. `/cats/taming` is
   removed (it then shows the site's not-found page), with everything that only
   Taming uses: its page, `taming.ts`, Taming's parts of `fight.tsx` and
   `fight-page.tsx`, and modules nothing else imports once Taming is gone
   (find them with the importers, e.g. `locked-pointer.ts`, `player-sprite.tsx`;
   check each). Anything Survival, the dashboard or the cats still use stays
   (`fake-cursor.tsx`, `movement-pad*`, `walking.ts`, `field-guide.ts`, …);
   where a shared module mentions Taming, only that part goes. Tests of removed
   code go with it; tests of what stays are kept and still pass. The tamed-cat
   collection stored in the browser is no longer read; no clean-up of old
   storage is needed. List every removed file and why in `decisions.md`.
   Update text that names Taming (the gallery, `CLAUDE.md`'s table, comments).
   E2E: `/cats` shows one Play link that opens Survival; `/cats/taming` is not
   found.
   _Explicitly lifts §3's "deleting a file you did not create" for task 1, for
   files only Taming uses and their tests._

2. **Every upgrade does what it says, every time it is taken.** Today some
   picks change nothing visible: Scissors adds `floor(level / 2)` projectiles
   (`arsenal.ts`, `modifiers`), so its first and third picks add none, and a
   weapon's `count` (e.g. the Laser Pointer's beams, 1 → 4 over 8 levels) is
   interpolated and rounded down, so it grows only every second or third level.
   Instead:
   - **Passives**: every pick adds its effect, the same step each time
     (Scissors: +1 of what each weapon fires per pick).
   - **Weapons**: every level adds something the player notices, and the
     level-up card says exactly what (e.g. "Level 3: +1 beam", "Level 4: 15%
     faster"), derived from the stats table so card and effect cannot disagree.
   - Rebalance where this makes the game easier or harder; the existing seeded
     balance test (T12 item 11 of the last run) must still hold, adjusted only
     with the reason in `decisions.md`.
   Unit tests: for every weapon and passive, each level's stats differ from the
   level before in what its card says, and in nothing it does not say. E2E: a
   level-up card names the change.

3. **Sound settings in the lobby and the pause menu.** Survival's lobby and
   pause menu get a settings section with the sound on/off switch (the existing
   setting in `sounds.ts`, its default and storage unchanged), on desktop and
   touch screens. Changing it in either place takes effect at once and is the
   same setting the rest of the site uses. Keyboard reachable, labelled. E2E on
   desktop and touch: switch sound off in the pause menu, resume, and the
   setting holds; the lobby shows the same state.

4. **Aim with a crosshair (desktop option).** In the settings from task 3, on
   desktop only (a fine pointer), an **Aim: automatic / crosshair** choice,
   automatic by default and remembered in the browser like the game's other
   settings. With crosshair on, a crosshair follows the mouse over the arena,
   and **every weapon that sends something in a direction fires toward it**
   instead of at the nearest cat. Exceptions, which work as today: the vacuums
   (Vacuum Cleaner, Thunderous Vacuum, and the evolved Forbidden Catnip Vacuum),
   and weapons that do not aim at all (those that circle the Keeper). Record
   which weapons aim and which do not in `decisions.md`. The Keeper still walks
   with the keyboard; the pointer is not locked. Co-op: the crosshair belongs to
   the player using the mouse; the second player's weapons aim automatically.
   Unit tests on the simulation: with an aim point, every aiming weapon's shot
   heads for it; the exceptions are unchanged. E2E: the option appears on
   desktop and not on a touch screen; with it on, the crosshair is drawn and
   follows the mouse. Depends on task 3.

5. **The pause menu shows the run so far.** Today it holds a heading, a line
   and Resume / Give up. Add, on desktop and touch screens:
   - **Weapons**: each one held, with its level and the highest it can reach
     (`Laser Pointer 3 / 8`), an evolved weapon marked as such, and what its
     next level adds (task 2's wording); free weapon slots
     (`Weapons 3 of 6`).
   - **Passives**: each one held, with its level and what it gives now
     (`Scissors 2 / 5: +2 projectiles`); free passive slots
     (`Passives 2 of 6`).
   - **Evolutions within reach**: for each pair in `EVOLUTIONS` the Keeper has
     started, what is still missing (the weapon's highest level, the passive),
     and that a chest then evolves it.
   - **The run**: time survived, level and experience to the next, Resolve,
     cats sent home.
   - **Co-op**: both Keepers' weapons and passives, each under its player's
     name.
   The numbers come from the simulation's own state and the same functions the
   level-up cards use, never a second copy of the rules. It fits a phone screen
   (scrolls inside the dialog if it must), Resume stays the first thing focused,
   and it reads sensibly to a screen reader (lists, not a drawn table).
   Unit tests on what the menu is built from: levels, free slots and evolution
   hints for a seeded run's state. E2E on desktop and touch: pause after a
   level-up; the menu names the weapon taken at its level and the free slot
   counts. Depends on task 2.

6. **Regular enemies are the drawn cats; the 20 artwork cats are special.**
   Today the twenty cat types with finished artwork (`'xenocat'` in
   `SCHEDULE.arrivals`, `varieties.ts`) arrive almost as often as the basic cat
   (weight 4 against 6). Instead, ordinary arrivals and swarms are only the
   game's own drawn varieties (`arena-art.ts`), and the twenty artwork cats
   appear only as **rare** arrivals, as elites (with their xenocat effect), and
   as bosses (the Matriarch stays the Titan Forest Cat). Meeting one is an
   event the player notices: a short notice with its name, as the elites
   already have, or the same if it is new. Keep the time-goal balance; adjust
   it with a seeded simulation test, reasons in `decisions.md`. Unit tests:
   over a seeded run, no ordinary arrival or swarm cat is an artwork cat; they
   do appear, rarely, as rare arrivals, elites and bosses.

7. **Survival is not too zoomed in on a phone.** On a narrow screen the arena
   shows so little around the Keeper that cats arrive before they can be seen.
   Make the camera show at least as much of the arena as a desktop shows
   around him, in the narrower dimension (e.g. zoom out on small viewports so
   the visible arena keeps a minimum width), without making the Keeper and cats
   too small to read; co-op's zoom-out still works on top. Record the rule in
   `decisions.md`. Unit tests on the camera: at a phone size (390 × 844) the
   visible arena is at least the minimum; at desktop sizes nothing changes.
   E2E at a phone size: the game starts and the camera's zoom is as the rule
   says (expose it like the HUD's other data attributes).

8. **Pet a sleeping cat on a touch screen** (2026-10-07 Q10). Today a tap on a
   sleeping cat wakes it, angry, and a touch screen can never pet one. A press
   held on a sleeping cat for `config.petMs` pets it, exactly as a resting
   pointer does on desktop; a quick tap still wakes it. Unit tests on the
   engine and E2E in the touch project: a long press pets, a tap wakes.

9. **Three cats' artwork colours** (`public/xenocats/cats/`, done with `sharp`
   in a script beside the last artwork scripts,
   `docs/ai/cat-artwork-2026-10-07/recolor.cjs` as the model; keep the new
   script in `docs/ai/night-2026-10-08/`):
   - **Laser Ocicat, awake**: the fur is too bright; tone it down to match its
     asleep image.
   - **Titan Forest Cat, asleep**: too dark; lighten it to match its awake
     image.
   - **Gravi-Coon**: awake and asleep have different fur colours; change the
     asleep image to the awake one's colour (the game shows the awake one).
   Change only the fur's colour and brightness: eyes, noses, outlines and the
   transparent background stay as they are, and the files keep their size and
   format. Measure each change (the fur's average hue and lightness, before and
   after, against the other pose) and record the numbers in `decisions.md`.
   Run the artwork unit tests (`tests/unit/xenocats/cat-art.test.tsx`).
   **Nobody will look at the result tonight: report it as built, not seen**, and
   name the three files for a human to look at.
   Not tonight (they need new artwork, a supervised session): Decoy Burmese's
   pattern, Gravi-Coon's smoother awake fur, Hypno Rex's asleep ears and face,
   Lag Ragamuffin's cut-out, Wobble Fold's asleep tail and leg markings.

10. **The landing page's header loses its two links.** `/` shows "Log in" and
    "Meet the cats" twice: small in the header's `<nav aria-label="Main">`
    (`app/page.tsx`) and large in the hero below it. Remove the header's pair
    (and its now empty `nav`); the header keeps the logo, and the hero's
    "Log in" button and "Meet the cats" link stay as they are. Check that the
    specs using these links (e.g. `branding.spec.ts`, `smoke.spec.ts`) still find
    the hero's, without relying on there being two. E2E on `/` at desktop and
    phone width: exactly one "Log in" link and one "Meet the cats" link, both
    in the hero, and each still leads where it did.

11. **Each account has its own customers and invoices.** Today every logged-in
    user sees and changes all of them. After this task a user sees, searches,
    exports and changes only their own; another user's are as if they did not
    exist. Read `.claude/rules/database.md` and `.claude/rules/security-review.md`
    first.
    - **Schema** (`db/migrations/0005_customer_owners.sql`, a new file, never an
      edit of an applied one): `customers.owner_id`, a UUID referencing
      `users (id)` (`ON DELETE RESTRICT`), indexed. An invoice belongs to whoever
      owns its customer; invoices get no owner column of their own. The
      migration must work on a database that already has rows: add the column
      nullable, give every existing customer to the only user when exactly one
      user exists, then make it `NOT NULL`. With rows and not exactly one user,
      it stops with a message saying a human must assign them (no guessing). The
      `revenue` table is not used by the app; leave it.
    - **Seed** (`app/lib/placeholder-data.ts`, `scripts/db.mjs`): the seed's
      customers belong to the demo user, so the browser tests' and database
      tests' schemas work as before.
    - **The session carries the user's id** (`auth.config.ts` callbacks,
      `checkCredentials`). A session without one counts as signed out (an old
      login made before tonight logs in again).
    - **Every read and write is scoped to the session's user**, taken on the
      server, never from a form field or argument the browser sends: every
      query in `app/lib/data.ts`, every action in `app/lib/actions.ts` (an
      invoice may only be created for, or moved to, one of the user's own
      customers), and the CSV export route. Another user's customer or invoice
      id gives the same not-found page (`notFound()`) as an unknown id, and the
      same refusal from an action, never a different message.
    - Record in `decisions.md` every query and action changed and how.
    Tests: database tests (`tests/unit/data.test.ts`, `DATABASE_TESTS=1`): two
    users' data never appear in each other's reads, counts, totals, search or
    export. Action tests: updating or deleting another user's invoice or
    customer, or creating an invoice for another user's customer, is refused
    and changes nothing. A migration test, on its own scratch schema: rows
    present with one user are all given to that user. E2E: a second user (made
    in the test's own setup, directly in `xenocats_test`) opens the demo user's
    invoice and customer URLs and gets not-found, and their lists and export
    are empty. The full suites run at this task's gate, whatever the selector
    prints. If `npm run build` fails only because `xenocats` lacks the new
    column (a page that queries it while prerendering), that is expected: do
    not migrate `xenocats`; record the failure, rely on CI's build job (which
    migrates its own database) for the build, and say so in the report.

12. **Create an account from the login page.** Depends on task 11. The login
    form (`app/ui/login-form.tsx`) gets a "Create an account" link to a new
    page, `/signup`, in the login page's style, with name, email, password and
    confirm password. A Server Action validates with zod (reuse the password
    rules `changePassword` already uses; the email trimmed and lowercased),
    hashes with bcrypt as the existing users are, and inserts the user. A taken
    email is refused with a field error ("An account with that email already
    exists"); the database's unique constraint is the final check, so two
    sign-ups racing cannot both succeed. On success the new user is signed in
    and lands on `/dashboard`, which shows empty states (no customers, no
    invoices, zero totals) without errors. Signed-in users visiting `/signup`
    are sent to `/dashboard`, like `/login`. The page links back to log in.
    Accessible like the login form (labels, `aria-describedby` errors).
    Not tonight, recorded in `questions.md` as proposals: a limit on sign-ups
    per address or time, email verification, and deleting an account.
    Tests: unit tests of the schema (bad email, short or mismatched passwords).
    E2E: sign up with a fresh email, land on an empty dashboard, log out, log
    back in with it; sign up with the demo user's email is refused; the login
    page links to `/signup` and back. Update what says there is no sign-up
    (e.g. the comment in `tests/e2e/change-password.spec.ts`, `README.md`).

## Exploration

Improving the Survival game, and fixing bugs in the game and the cats. Rotate
between the two kinds: **the Survival game**, **bugs**.

Candidates to start with:

- Gamepad support (the browser's Gamepad API): move, pause, choose a level-up.
- Per-weapon numbers on the results screen: homesickness dealt and cats sent
  home by each weapon.
- The best time per character, with its date, beside the overall best.
- The frame rate with a crowded arena on a phone-sized screen: measure it with a
  seeded test of the simulation's step cost, and fix what it finds.
- New drawn enemy varieties with a behaviour that plays differently (not just a
  new look), new weapons, passives and evolution pairs, each with its art drawn
  in `arena-art.ts`.
- The cats gallery on `/cats` says which cats are rare, elites or bosses in
  Survival (after task 6).

Not in exploration: dashboard features, anything that needs a new dependency,
Superdesign or any outside service, new artwork for the 20 cat types, online
multiplayer, and the 2026-10-07 run's Q1, Q5, Q7 and Q12. Those go to
`questions.md`.
