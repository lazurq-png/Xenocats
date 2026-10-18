# Questions

## Q3 — a stronger leaderboard check (proposed task for a next plan; from T1)

T1 keeps hooked runs off the board in the client only (D6): the server cannot tell a hooked, idled or forged run from a played one, as long as its time fits the real time elapsed. Options, strongest first:

1. **Server-side replay.** The client sends the seed and the input log (moves and level-up choices per frame); the server re-runs the deterministic simulation (`arena.ts` is pure and seeded) and ranks the time it computes. Exact, and takes cheating off the board, but it costs server CPU per run (a 15-minute run is about 54,000 steps) and needs the simulation to be deterministic across Node and browsers (floating point).
2. **Heartbeats.** The client reports its clock, cats sent home and level every ~30 s to a Server Action, and the server rejects a finished run whose heartbeats are missing or implausible. Cheaper. Raises the bar but does not stop a scripted client.
3. **Plausibility only.** Add a floor to the cat rate (a run of 5 minutes sending home 3 cats was not played) and a cap on the level reached for the time. Cheap, catches only crude forgeries.

Recommendation: 3 now (a small task), 1 if the board ever matters. Meanwhile: nothing more than T1.

## Q5 — patches and swatted cats have no owner in co-op (from T3's review; a proposed small task)

`Patch` (toys, boxes, puddles) and a swatted cat in flight do not record which Keeper's weapon made them, so their damage uses player 1's passives (`hero` is `keepers[0]` in `updatePatches` and `bowl`), and T3's per-weapon credit checks player 1's weapons for a fusion. Giving both an `owner`, as projectiles and socks have, would make player 2's patch damage use his own passives: a gameplay change, so it is proposed rather than done.

## Q9 — where the render benchmark's time goes (from E2, E5, E7, E9; a proposed task)

All four speed candidates the plan named were tried and measured interleaved: the beams in one path (E2), the HUD's state read less often (E5), cat sprites at their drawn size (E7), and gems and shots filled per colour (E9). None moved the ×4-CPU render benchmark, and E9 made it 14% slower. Before the next speed item, a profile of one crowded frame (Chrome's Performance panel, or `performance.mark` around the draw passes in `arena-view.tsx` under `?fps=1`) would show which pass dominates, so the next change aims at it, not at a guess.

Found since (E10): drawing is a tenth of a crowded frame (×4 CPU, 20 s: 2.1 s at 500 cats, 1.8 s at 2000), and the simulation's steps a sixth to a quarter (2.9 s, 5.2 s). The frame's own JavaScript is 6.1 s and 8.0 s in all. Much of the rest is React rendering the whole `ArenaGame` component (about 1,700 lines) at every HUD update. Updating it every 500 ms instead of every 150 ms gave +16% / +21% fps, and every 250 ms +9% / +9% (E10 took 250). A proposed task: move the HUD into a component of its own, fed by a small store (`useSyncExternalStore`), so an update renders the HUD alone. That could give the 500 ms gain or more, with the HUD as smooth as before. It is a refactor of the arena view, larger than an exploration item.
