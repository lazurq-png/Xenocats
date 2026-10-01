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
