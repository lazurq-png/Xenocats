# Questions — night-2026-10-01

## Q1 — CI: the "fight" browser tests fail on GitHub's runner, pass locally (most consequential)

**State.** Since checkpoint 1 (`c4df896`), both CI browser jobs fail, and since
`fdbc6cd` the named groups show it is only `tests/e2e/fight.spec.ts`: the
"Browser tests (fight)" and "Browser tests against next start (fight)" steps,
~45 s each, failing even with CI's one retry. Everything else in CI passes,
including every unit group. Locally the same file passes every time, also
under `CI=1 --workers=1`, against `next dev` and against `next start`. The
run cannot read CI logs (they need auth), so it could only infer the cause.

**Three fix cycles, all failed** (the run's limit for one failure):
1. `53251eb` — hypothesis: Linux headless refuses pointer lock → the lock test
   skips itself when refused. CI still failed.
2. `fdbc6cd` — no guess: named per-spec groups so CI reports which spec fails
   (it is fight), each group's report kept separately; also fixed a real flake
   in the Taming dodge test (polling missed one-frame dodges). Still failed.
3. `6a30700` — hypothesis: the headless page has no focus, so losing the lock
   pauses instead of ending the game → the lock test checks whichever the
   browser's focus calls for. Still failed.

**Suspects left** (all added in checkpoint 1, since `fight.spec.ts` passed CI
through T5): the pause test ("losing focus pauses the game… Resume carries
on", incl. Tab/Shift+Tab wrapping) and the pointer-lock test's earlier steps
(pointer moving by exactly the mouse movement; the banish loop).

**What a human should do:** open run
https://github.com/lazurq-png/Xenocats/actions/runs/36906133949, download the
`playwright-report` artifact, and look at `playwright-report/fight/` (the
failing test, its error and its retry trace under `test-results/fight/`).
Then either fix the test or, if it cannot be made reliable on the runner,
skip it there.

**Meanwhile:** every later task tonight is pushed onto a run branch whose CI
already fails in this one group; its own CI result is recorded as
"CI failed: inherited fight-group failure (Q1)" when only that group fails,
and as a real failure if anything else does.
- **Update (T7):** T7's local gate failed "Survival: banishing every cat of a
  wave survives it" once: it never reached wave 2 in 40 s because cats landed
  while it clicked others, their effects blocked clicks, and the game ended —
  after which the wave can never reach 2. That is a likely cause of the CI
  failure too (a slower runner, more landings). T7 makes the test start a new
  game when one ends; if T7's CI passes the fight group, Q1 is answered.
- **Update (T8):** T7's CI (`c697632`, runs 36909573185 / 36909567056) still
  fails the fight group only, with the wave test hardened — so that test was
  not (or not the only) cause. Remaining suspects: the pause/Tab test and the
  pointer-lock test (both added in checkpoint 1). The report artifact of any of
  these runs names the failing test.

## Q2 — An index for the searches? (needs an extension, and a query change)

The invoice search matches `ILIKE '%term%'` with one `OR` across both joined
tables (customer name and email, invoice amount, date and status). B-tree
indexes cannot serve a leading wildcard. A trigram index (`pg_trgm`) can, but
the run did not create the extension (database privileges; extensions live per
database, while the app and the tests use schemas). Even with it, trigram
indexes on `customers.name`/`email` would speed up the **customers** search
only: the invoice search's `OR` spans two tables of a join, which the planner
cannot serve from per-table indexes, so it would also need restructuring (e.g. a
`UNION` of customer-side and invoice-side matches, or one indexed text column of
the searched fields). Recommendation: only if the tables grow large.

## Q3 — Apply tonight's migrations to the `xenocats` schema

The run never writes to `xenocats`. A human runs `npm run db:migrate` to apply
`0002_invoice_keys_and_indexes.sql` (and any later migration from tonight). It
fails without changing anything if an invoice there names a missing customer.
It takes write-blocking locks on `invoices` and `customers` while it checks the
rows and builds the indexes (one transaction, so no `CONCURRENTLY`): on a large
live table, apply it when traffic is low.

Also `0003_invoice_due_dates.sql` (T14): adds `invoices.due_date`, fills it with
each invoice's date + 30 days, and makes it required. Until it is applied, the
app after T14 fails on every invoice read and insert against `xenocats`
(the column does not exist), so apply it before running that app.

## Q4 — Payment terms other than 30 days? (proposed task, not built)

T14 gives every invoice the due date "invoice date + 30 days" (D22); the forms
neither show nor change it. If invoices need other terms, a next plan could add
a due-date field to the create and edit forms (validated not before the
invoice date, as the database's check already requires).

## Q5 — "Pending" in the list vs. the dashboard's pending totals (product decision)

Since T14 the invoice list, its filter and the CSV split unpaid invoices into
Pending (not yet due) and Overdue. The dashboard's pending card and chart and
the customers table's "total pending" still add up every unpaid invoice,
overdue included; on the seed data every unpaid invoice is overdue, so the
list's Pending filter is empty while the dashboard shows a pending total. Not
wrong in the data, but two meanings of one word. Options: relabel those
figures "Unpaid" (smallest), or show overdue separately there too. The run
left them as they are (no task names them); checkpoint 3 raised it.

## Q6 — `npm test` now writes a schema on the development database (T16)

T16 (as the plan asked: "part of `npm test`") makes `npm test` rebuild the
`xenocats_vitest` schema on the server in `.env`'s `POSTGRES_URL`, like the
browser tests rebuild `xenocats_test`. `E2E_NO_DATABASE=1` skips it. The
night-run skill's database rule (§3) names only the browser tests and the
build, so this run never ran the file locally; CI ran it (build job). Two
things for a human:
- Run `npm test` once with `.env` present to see the database tests pass on
  the development server (CI's server is a fresh PostgreSQL with TLS on).
- If unattended runs should run them too, the skill's §3 needs to name
  `npm test` beside `npm run test:e2e`; otherwise runs keep setting
  `E2E_NO_DATABASE=1`.
