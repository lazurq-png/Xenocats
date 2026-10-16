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
