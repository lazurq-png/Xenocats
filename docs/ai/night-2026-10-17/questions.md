# Questions

## Q1 — a flaky touch e2e test (found at the baseline; no human decision needed, an exploration "bugs / flaky tests" candidate)

`tests/e2e/touch.spec.ts:7` failed once in the baseline's full `next dev` run at line 48: after `asleep.tap()`, `summon-status` still read "Pulsar Siamese is on its way." (the first summon's text), so the second Summon button's tap did not register. It passed 5 of 5 alone and in the full suite's second run. Likely cause (unverified): the tap lands while the cat's knockback is still moving the card's buttons around the touch, so it hits the old place of `summon-asleep-pulsar-siamese`. A failure there holds back every other group (80 tests did not run).

## Q2 — a Vitest process left running since before the run

`vitest run tests/unit/xenocats tests/unit/actions.test.ts` (PIDs 11888 and 16300, worker 7968) was started 2026-10-16 22:23, before this run, and was still busy (about one core, 7,500 CPU-seconds) at 00:30. The run did not start it and §2.3 does not let it end it. If it is stuck, ending it is a human's call. It may be making the timing-sensitive browser tests slower all night.

## Q3 — a stronger leaderboard check (proposed task for a next plan; from T1)

T1 keeps hooked runs off the board in the client only (D6): the server cannot tell a hooked, idled or forged run from a played one, as long as its time fits the real time elapsed. Options, strongest first:

1. **Server-side replay.** The client sends the seed and the input log (moves and level-up choices per frame); the server re-runs the deterministic simulation (`arena.ts` is pure and seeded) and ranks the time it computes. Exact, and takes cheating off the board, but it costs server CPU per run (a 15-minute run is about 54,000 steps) and needs the simulation to be deterministic across Node and browsers (floating point).
2. **Heartbeats.** The client reports its clock, cats sent home and level every ~30 s to a Server Action, and the server rejects a finished run whose heartbeats are missing or implausible. Cheaper. Raises the bar but does not stop a scripted client.
3. **Plausibility only.** Add a floor to the cat rate (a run of 5 minutes sending home 3 cats was not played) and a cap on the level reached for the time. Cheap, catches only crude forgeries.

Recommendation: 3 now (a small task), 1 if the board ever matters. Meanwhile: nothing more than T1.

## Q4 — the "screen full of attacks" test is chaotic (from T2; no decision needed, an exploration candidate)

`arsenal.test.ts` "a seeded five-minute run, choices made for it, ends with the screen full of attacks" checks one seed's peak against a fixed 30. Over seeds 1–10, its peak ranges from 22 to 152, and any change to a weapon moves which seed passes (D10). A sturdier form would be a median over several seeds, or the peak of a fixed build rather than one chosen by draws. That costs about 30 s per seed.

## Q5 — patches and swatted cats have no owner in co-op (from T3's review; a proposed small task)

`Patch` (toys, boxes, puddles) and a swatted cat in flight do not record which Keeper's weapon made them, so their damage uses player 1's passives (`hero` is `keepers[0]` in `updatePatches` and `bowl`), and T3's per-weapon credit checks player 1's weapons for a fusion. Giving both an `owner`, as projectiles and socks have, would make player 2's patch damage use his own passives: a gameplay change, so it is proposed rather than done.

## Q7 — the fusion pause-menu e2e test has a wall-clock deadline (an exploration "flaky tests" candidate)

`survival.spec.ts:251` ("the pause menu marks a fused weapon and a new one with different tiers") plays seeds for up to 120 s of real time until a level-up offers a weapon. In T3's repair run (the full `next dev` suite, 4 workers, and the foreign Vitest process of Q2 busy) it ran out of time with nothing taken; it passed 5 of 5 alone. A seeded way to reach a level-up offering a weapon (e.g. a fixed offer under `?fusion=1`, or reading the offer through the arena's state) would make it independent of the machine's speed.

## Q8 — CI's dev-server browser job fails now and then, never locally (needs the job's log, which needs a token)

T5's run (https://github.com/lazurq-png/Xenocats/actions/runs/38987634906, 3d92164) failed in _Browser tests (dev server)_, the step running smoke, security headers and dashboard login against `next dev`. The other three jobs passed. T5 changed the Survival arena and its tests, which those specs do not reach. Locally, the job's own command (`CI=1 E2E_NO_CAT_DEPS=1 npx playwright test tests/e2e/smoke.spec tests/e2e/security-headers.spec tests/e2e/dashboard.spec`) passed 3 of 3 warm and 1 of 1 cold (`.next` deleted). The 2026-10-09 run saw the same job fail once the same way (its D67). Its log and the uploaded `playwright-report` artifact need an authenticated download, outside what the run may do. A human with access could read which test failed in that run's artifact.

## Q9 — where the render benchmark's time goes (from E2, E5, E7, E9; a proposed task)

All four speed candidates the plan named were tried and measured interleaved: the beams in one path (E2), the HUD's state read less often (E5), cat sprites at their drawn size (E7), and gems and shots filled per colour (E9). None moved the ×4-CPU render benchmark, and E9 made it 14% slower. Before the next speed item, a profile of one crowded frame (Chrome's Performance panel, or `performance.mark` around the draw passes in `arena-view.tsx` under `?fps=1`) would show which pass dominates, so the next change aims at it, not at a guess.

Found since (E10): drawing is a tenth of a crowded frame (×4 CPU, 20 s: 2.1 s at 500 cats, 1.8 s at 2000), and the simulation's steps a sixth to a quarter (2.9 s, 5.2 s). The frame's own JavaScript is 6.1 s and 8.0 s in all. Much of the rest is React rendering the whole `ArenaGame` component (about 1,700 lines) at every HUD update. Updating it every 500 ms instead of every 150 ms gave +16% / +21% fps, and every 250 ms +9% / +9% (E10 took 250). A proposed task: move the HUD into a component of its own, fed by a small store (`useSyncExternalStore`), so an update renders the HUD alone. That could give the 500 ms gain or more, with the HUD as smooth as before. It is a refactor of the arena view, larger than an exploration item.
