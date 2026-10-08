# Decisions — night run 2026-10-08

Non-obvious choices, numbered `D1`, `D2`, …, each with its reason, including acceptance criteria derived for an underspecified task.

## T1 — Taming is removed; `/cats` has one Play button

**D1 — Files removed** (the plan's task 1 lifts §3's "deleting a file you did not create" for these). Each was found by its importers before and after (`grep -rl "from './<module>'"`):

| File | Why it only served Taming |
| ---- | ------------------------- |
| `app/cats/taming/page.tsx` | Taming's page; `/cats/taming` now falls to the site's not-found page. |
| `app/ui/xenocats/fight.tsx` | The Taming game itself (its only importer was `fight-page.tsx`'s Taming branch). |
| `app/ui/xenocats/taming.ts` | Taming's rules and its tamed-cat collection (`xenocats:tamed`). |
| `app/ui/xenocats/player-sprite.tsx` | The ranger drawn by `fight.tsx` only (Survival draws its Keeper on the canvas, `arena-art.ts`). |
| `app/ui/xenocats/locked-pointer.ts` | Pointer lock for `fight.tsx` only. |
| `tests/unit/xenocats/taming.test.ts`, `tests/unit/xenocats/locked-pointer.test.ts` | Tests of the two removed modules. |
| `tests/e2e/fight.spec.ts` | Every test drove Taming; its one other test (links from `/cats` to both games) is replaced by the Play-link test in `survival.spec.ts`. |

**D2 — Shared modules: what went, what stayed.**
- `walking.ts`: `FACINGS`, `Facing`, `facingTowards` and `createGameClock` were used only by `fight.tsx` and `player-sprite.tsx`; removed with their unit tests. `walkDirection`, `isWalkKey` and `PLAYER_KEYS` stay (the arena and the movement pad).
- `field-guide.ts`: the guide's "tamed" count read Taming's collection; removed (type, store, `recordTamed`). The guide keeps met and survived. The card shows two counts, not three. Old `xenocats:tamed` data in a browser is simply no longer read (the plan: no clean-up); an e2e test stores some and checks it is not shown.
- `fight-page.tsx`: renders only Survival; the `kind` prop, the cat layer and the fake cursor it set up for Taming are gone. The name stays (it is the game page's wrapper; renaming it would only add churn).
- `global.css`: the ranger's walking animation (`xenocat-player-*`) and the old beam classes (`xenocat-beam`, `-home`, `-column`, not the `xenocat-beam` keyframes the effects use) had no user left; removed.
- Kept: `fake-cursor.tsx`'s `hide()` (last called by `fight.tsx`): a general part of the cursor's API, with `isHidden()` still read by `cat-layer.tsx` and covered by `fake-cursor.test.tsx`; removing it would change the cats' code for no gain. `movement-pad*`, `walking.ts`, `cursor-controller.ts`, `field-guide.ts` stay (Survival, the dashboard's cats, the gallery).
- `.github/workflows/ci.yml`: the unit groups no longer name the two removed test files, and the browser groups no longer name `tests/e2e/fight` (a filter that matches no file would make `vitest run` fail). The steps are renamed "(Survival)".
- `README.md`: the `/cats/taming` route line removed. `CLAUDE.md` names no Taming file, so it needs no change.

**D3 — Acceptance criteria.** `/cats`'s "Fight a cat" section holds exactly one link, "Play", to `/cats/survival`, and describes Survival only; `/cats/taming` answers 404 with the site's not-found page; no module, test or CI step names a removed file; every remaining suite passes.

**D4 — Review.** The `reviewer` requested changes with one Medium finding: `tests/unit/affected-tests.test.ts` used the deleted `tests/e2e/fight.spec.ts` as its example of an existing spec (one assertion failed, one no longer checked anything). Already found by the gate's `npm test` and fixed as the reviewer recommends: both lines now use `tests/e2e/survival.spec.ts` (another `/cats` spec, outside the invoices area). A two-line fixture change, so no re-review; `npm test` and both full browser suites ran after it. The reviewer also asks a human to look at the gallery card's two counts (`grid-cols-2`).
