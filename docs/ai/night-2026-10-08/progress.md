# Progress — night run 2026-10-08

Append-only. One entry per task, appended when it ends; the morning report is inserted at the top.

## Run start

- Goal: "Friday 07:00" → **Deadline: 2026-10-09 07:00** (Europe/Stockholm; machine time zone `W. Europe Standard Time`).
- Clock at start: 2026-10-08 14:24. Budget at start: 14,971,497 tokens (reserve 10% ≈ 1.5M with a session to follow; 30% ≈ 4.5M when final).
- Run branch `night-2026-10-08`, cut from `main` at `ae34cbc`. Remote `origin` reachable; no `night-2026-10-08*` branch there. Tree clean at preflight (no pre-existing changes).
- Environment: node v24.19.0, npm 11.17.0, `node_modules` and Chromium present, `.env` present.
- Timer: the human's `/loop 20m` job `ffa0ab35` (every 20 minutes) is the run's timer; no other armed.
- Limits (from the plan): information only. The run cannot see the account's usage limit; if it runs out, the session pauses until the timer's next firing after it resets, and the per-task commit and push bound the loss.

### Baseline (§1.5), 14:25–14:35

All green, run one after another on `ae34cbc`:

- `npm run lint`: exit 0, **0 warnings** (`lint-baseline.txt`), 95 s.
- `next typegen && tsc --noEmit`: exit 0, 42 s.
- `npm test`: exit 0; 44 files passed, 1 skipped; 664 tests passed, 17 skipped (the opt-in database tests); 57 s.
- `DATABASE_TESTS=1 npx vitest run tests/unit/data`: exit 0; 17 passed, none skipped; 29 s.
- `npm run build`: exit 0, 50 s. The build is in the gate.
- `npm run test:e2e` (next dev): exit 0, 131 passed, 3.2 min.
- `E2E_SERVER=start npm run test:e2e`: exit 0, 131 passed, 2.1 min.
- `next-env.d.ts` and `AGENTS.md` unchanged after the checks.

## T1 — Taming is removed; `/cats` has one Play button (completed)

- Branch `night-2026-10-08-t1-remove-taming`, base `ae34cbc`. Start 14:35 (budget ~14,967,000); completed 14:50 (budget ~14,902,000).
- **What the code does**
  - `/cats` (`cat-gallery.tsx`): the "Fight a cat" section describes Survival only and holds one link, **Play**, to `/cats/survival`. The field guide counts met and survived per cat; the "Tamed" count is gone (`field-guide.ts`).
  - Removed: `/cats/taming` (now the site's 404 page), `fight.tsx`, `taming.ts`, `player-sprite.tsx`, `locked-pointer.ts`, their unit tests and `tests/e2e/fight.spec.ts`; Taming-only helpers in `walking.ts` and dead ranger/beam CSS in `global.css`. `fight-page.tsx` renders Survival only.
  - CI (`ci.yml`): test groups no longer name the removed files; the browser steps are named "(Survival)". `README.md` drops the `/cats/taming` route.
  - Tests: `survival.spec.ts` checks the single Play link opens Survival and `/cats/taming` answers 404; `field-guide.spec.ts` checks an old Taming collection is not shown; the unit tests follow the smaller field guide and `walking.ts`.
- **What it brings**: one game instead of two, so `/cats` points straight at Survival and about 1,700 lines of a game nobody was to play again stop costing test and review time. Decisions: D1–D4.
- **Verification** (the selector printed FULL for the deleted page, so every suite ran)
  - prettier on the 13 changed files (staged LF content; the working tree is CRLF via `core.autocrlf`): clean after formatting two test files.
  - `npm run lint` exit 0, 0 warnings (= baseline). `next typegen && tsc --noEmit` exit 0, after deleting `.next/dev/types`, stale route types this run's own baseline `next dev` wrote while `/cats/taming` existed.
  - `actionlint` (with shellcheck and pyflakes) exit 0; CI's "every test file is in a group" loop, run locally: no file missing.
  - `npm test`: first run 1 failed (`affected-tests.test.ts` named the deleted spec), fixed; then 42 files passed, 1 skipped; 639 passed, 17 skipped.
  - `DATABASE_TESTS=1 npx vitest run tests/unit/data`: 17 passed. `npm run build` exit 0.
  - `npm run test:e2e` (next dev): 127 passed. `E2E_SERVER=start npm run test:e2e`: 127 passed.
  - Acceptance criteria (D3): all checked by command (the browser tests above), except "describes Survival only", checked by reading.
- **Reviewer**: request changes, one Medium finding (the same selector test), fixed as recommended (D4). **Tested in a browser, not seen**: a human should look at `/cats`'s Fight a cat section and a field-guide card with two counts.
