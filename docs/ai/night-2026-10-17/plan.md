# Night run 2026-10-17

## Goal

2026-10-17 10:00

## Limits

Information only. A run of about ten hours; it may meet the account's usage
limit. At a limit the session pauses until the timer's next firing after it
resets, and the per-task commit and push bound what is lost. Started from the
Claude CLI (`docs/ai/README.md`, "Starting it from the CLI").

## Design decisions (made by the human; the run does not revisit them)

- **Base.** `main` includes `e2876b7` (six new weapons and passives, slots by
  run length, Endless mode). Tasks 2 and 5 build on it.
- **Order.** 1, 2, 3, 4, 5, 6, **checkpoint 1**, 7, 8, **checkpoint 2**, then
  exploration (`## Exploration`) until the goal time, with a checkpoint after
  every 5th exploration item.
- **Dependencies.** None between tasks, except that a checkpoint covers what was
  merged before it. A task that cannot be done as written is parked (§4) and
  the run goes on with the next.
- **Databases.** Only the development server in `.env` (a private address), and
  on it only what the skill allows: `xenocats_test` (browser tests),
  `xenocats_vitest` (database tests), and `xenocats` read by the build. Never a
  write to `xenocats`, never `npm run db:*`. No task here needs a migration; if
  one turns out to, park it.
- **No new dependencies, no outside service, no Superdesign.** New art is SVG
  in `arena-art.ts`, like the game's existing art. The 20 cat types' artwork is
  not changed.
- **The cats' existing rules still hold** outside the Survival game: never more
  than 5 cats on screen, one effect at a time, the keyboard never affected, no
  off switch a user can see or reach, cats and effects hidden from assistive
  technology, every page effect reverts exactly.
- **Balance.** The existing seeded balance tests must still hold for the
  5-minute run. A task may adjust them only with the reason and the numbers in
  `decisions.md`.

## Checkpoint (after tasks 6 and 8, then after every 5th exploration item)

A task like any other (`2026-10-17-c<N>-checkpoint`, through the whole of §2),
covering everything merged since the previous checkpoint (the first covers the
run from its base):

1. **Tests.** Is every changed behaviour covered by a test that would fail
   without it? No test of removed behaviour, no duplicate, no test that cannot
   fail. Add what is missing. _Explicitly lifts §3's "deleting a file you did
   not create" for test files under `tests/` only._
2. **Quality and security.** Dispatch the `reviewer` on the range, with
   `.claude/rules/security-review.md` in scope. Fix every finding within the
   checkpoint, or record why not.
3. **Speed.** Run the simulation and render benchmarks (the 2026-10-09 run's
   task 9) and record their numbers next to the last ones recorded. A slowdown
   of more than 10% is a finding: find its cause and fix it, or record why not.
4. **Full suites.** Both browser suites (`next dev` and `E2E_SERVER=start`),
   one after the other, never together.
5. Append a `## Checkpoint <N>` entry to `progress.md`: what was checked, found
   and changed.

## Tasks

1. **A run that used a test hook is never ranked.** The Survival test hooks
   (`test-hooks.ts`: `?seed`, `?boss`, `?speed`, `?pickups`, `?fps` and any
   others) are live in production, and since the leaderboard exists they let a
   player post a time they did not play for (the 2026-10-09 run's checkpoint 3
   review). After a run in which any hook was active, the results screen does
   not offer the leaderboard entry and says why in one line; the hooks keep
   working for the tests. Record in `decisions.md` what the server can and
   cannot check about a submitted run, and propose anything stronger in
   `questions.md` rather than building it. Unit test: a run with a hook active
   is marked unrankable, one without is not. E2E: a seeded run (`?seed=`)
   reaching its results shows no leaderboard entry.

2. **The six new weapons each do something of their own.** Tennis Ball, Frying
   Pan, Static Sock, Cucumber, Ceiling Fan and Alarm Clock (`arsenal.ts`) reuse
   existing weapon kinds with new numbers. Give at least four of them a
   behaviour no other weapon has (a new `WeaponKind`, fired in `arena.ts`), in
   the game's voice (e.g. the Cucumber startles cats into running away; the
   Alarm Clock rings in bursts that stun; the Frying Pan swats cats back),
   with art in `arena-art.ts` for each new projectile or effect. Their
   evolutions keep outclassing their base by the existing seeded measure.
   Record each kind in `decisions.md`; keep the 5-minute balance test. Unit
   tests: each new kind fires as described. **Report the art as built, not
   seen**, and name what a human should look at.

3. **The results screen says what each weapon did.** For each weapon held in
   the run (evolved and fused included): homesickness dealt and cats sent home,
   highest first, as a list a screen reader reads sensibly. Counted in the
   simulation, not the view. Unit tests on the counting; E2E: the results of a
   seeded run name the starting weapon with a non-zero count.

4. **Best times per length and character, with the date.** Beside the overall
   best, the lobby shows each character's best for the chosen length (Endless
   included: its best is the longest survived), with the date it was set.
   Old stored bests are kept and count as they do today. Unit tests on the
   storage; E2E: a finished seeded run shows its time as that character's
   best.

5. **The checkpoint 3 review's leftovers** (2026-10-09 progress.md, "What
   nothing has checked"): a stunned Mega Cat gets the elite cooldown instead of
   its pounce's — fix it, with a unit test that fails before; the unit test
   "Matriarch never calls once she is on him" cannot fail alone — make it able
   to; the two overlapping reroll/skip e2e specs — merge them into one that
   covers both.

6. **The dashboard's customers page can be sorted.** On
   `/dashboard/customers`, the column headers Name, Total invoices, Total
   pending and Total paid sort the table, ascending then descending, with the
   sort in the URL (`?sort=`, `?dir=`) like search and page are today. Sorting
   happens in the SQL query in `data.ts`, with the column chosen from a fixed
   list (never interpolated from the URL). Headers are buttons with
   `aria-sort`. Unit (database) test: each sort orders the rows; an unknown
   `sort` falls back to name. E2E: clicking Total paid twice reverses the order
   and survives a reload.

## Exploration

Rotate between four kinds, one item each, in this order: **bugs**,
**speed on a weak machine**, **security and quality**.

- **Bugs**: found by reading the Survival game's and the cats' code
  (`arena.ts`, `arsenal.ts`, `cat-engine.ts`), and flaky tests.
- **Speed on a weak machine**: measure before and after with the benchmarks;
  an item that does not move a number is reverted, not merged. Candidates:
  glow sprites instead of per-frame `shadowBlur`; one path and fill per colour
  for gems and shots; cat bitmaps pre-scaled to their drawn size; the HUD's
  React state updated at most ~10 times a second.
- **Security and quality**: Server Actions and route handlers
  (`actions.ts`, the CSV export, sign-up and the leaderboard entry): input
  validation, session checks, rate limits.

Not in exploration: new dashboard features, new artwork for the 20 cat types,
anything needing a new dependency, a migration or an outside service, WebGL or
a worker renderer, online multiplayer. Those go to `questions.md`.
