# Decisions — night-2026-10-01

## D1 — The formatting check reads LF-normalised content (run-wide)

`core.autocrlf=true` checks files out with CRLF while `.prettierrc` says
`endOfLine: lf`, so `prettier --check` fails on every unchanged checked-out
file. As in the previous run (`night-2026-09-25` D3), the gate checks
`tr -d '\r' < f | npx prettier --check --stdin-filepath f` for edited files;
new files are written with LF and checked directly.

## D2 — T1 acceptance criteria, and what "the locked pointer itself" means

Acceptance criteria derived from plan task 1:

1. A "Fight a cat" section on `/cats` with a Start button.
2. Start requests pointer lock; while locked, the game owns the pointer position
   (from `movementX/Y`) and cats attack that position.
3. Esc releases the lock and ends the game.
4. Cats arrive in waves; each wave has more cats, sooner (frequency) and faster
   (speed); never more than 5 on screen.
5. A cat reaching the pointer lands its attack and costs one of 3 lives.
6. Clicking a cat banishes it.
7. Score = waves survived; best score kept in `localStorage`.
8. Losing the lock other than by Esc (tab switch, window blur) pauses.
9. Pointer lock refused or missing → the game runs with the fake cursor.
10. Waves, lives, hits and scoring are pure and unit-tested.

"Attack the locked pointer itself, not a drawing of it": under pointer lock the
browser hides the system pointer and reports only movement, so any visible
pointer is drawn by the page either way. The difference made concrete
(`locked-pointer.ts`): the effect's output *is* the pointer's position — clicks
hit there, cats chase it — and when the effect ends the pointer stays where
the effect left it, rather than snapping back to an untouched "real" pointer as
the fake cursor does. Effects are reused unchanged through `cursor-controller.ts`.

Waves: a cat chases the pointer from a random screen edge (≥ 240 px away) and
lands when within 24 px. Wave n has `3 + (n-1)` cats, arrivals every
`1800·0.88^(n-1)` ms (≥ 350), speed `80·1.15^(n-1)` px/s (≤ 520). All in
`SURVIVAL_CONFIG`.

## D3 — Telling Esc from a tab or window switch

All three only show up as a `pointerlockchange` with no lock element; browsers
swallow the Esc keydown under lock. 100 ms after the lock is lost, the page
still focused and visible means Esc → end; otherwise → pause. `blur` and
`visibilitychange` pause as well (they also pause the fallback mode). Resume
needs a click, since pointer lock needs a user gesture; if the lock is refused
then, the game carries on in fallback mode.

## D4 — Cats on screen during a game

The 5-cat limit counts summoned gallery cats: the game gets
`5 − cats already on screen` as its room each tick (new `count()` on the cats
context). The Summon buttons are disabled while a game runs, so nothing can
push past 5 the other way. While a game runs the fake cursor is hidden in
locked mode (new `hide()` on the cursor context) and the game draws its pointer
with the shared `placeCursor` / `CursorShape`.

## D5 — `summon-status` test id on the roster's status line

The Fight section adds a second `role="status"` region to `/cats`, so three
existing tests' bare `page.getByRole('status')` became ambiguous (strict-mode
failure). They now target the roster's line by `data-testid="summon-status"`;
the asserted texts are unchanged.
