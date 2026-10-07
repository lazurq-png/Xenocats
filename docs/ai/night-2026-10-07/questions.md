# Questions — night run 2026-10-07

What needed a human: the question, the options and their consequences, the recommendation, and what was done meanwhile.

## Q1 — Should CI's "Database tests" step fail when every database test skipped? (proposed task, not built)

From T1's review. With the tests opt-in, a CI step that lost its `DATABASE_TESTS: '1'` (or its `POSTGRES_URL`) would report green with 17 skipped tests. Option: run the step with a reporter check (e.g. fail if the vitest JSON summary shows 0 passed). Recommendation: a one-line guard in the next plan; low urgency. Meanwhile: nothing changed.

## Q2 — Should clicks be blocked while page elements are displaced? (T2)

The plan's task 2 says "clicks stay blocked while elements are displaced". They are not blocked today: commit `d53f566` (2026-10-02, by hand) removed the blocking, and `fake-cursor.tsx` says "Clicks are never blocked: one made while an effect runs lands where the real pointer is". Options: (a) keep it as it is (what was done: "stay" asks for no change); (b) restore blocking of mouse clicks while any element is displaced, as the 10-01 run had it (a small task: listeners in `fake-cursor.tsx`, the touch path too, an e2e test). Recommendation: decide which one the game wants; (b) fits in the next plan.

## Q3 — Five cats now do nothing visible to the page (T2)

Heavy (Gravi Coon), Reverse (Mirror Sphynx), Decoys (Decoy Burmese), Delay (Lag Ragamuffin) and Axis lock (Laser Ocicat) only change how the cursor follows the mouse. A page element held still is unaffected, so under "does what the attack does to the pointer, and nothing else" they leave elements alone (decisions D4). If every cat should still touch the page somehow, the next plan could name a visible equivalent per cat (e.g. Decoys: faint copies of the element). Nothing built meanwhile.

## Q4 — CI: the dev-server browser tests failed once on an unchanged tree (T1)

Commit `60801d2` ran twice on GitHub. On `night-2026-10-07` every job passed (run 37622699500). On `night-2026-10-07-t1-db-tests-opt-in` the job "Browser tests (dev server)" failed in its step "Browser tests (smoke, branding, dashboard, login, settings, headers, states, keyboard, intensity)" (run 37622695999). The failing test is not visible without logs (they need auth). Locally, `keyboard.spec.ts:129` timed out once, under load (the overlapped baseline, progress.md). A human with access can read that run's `playwright-report` artifact. No repair was attempted: the identical tree passed.
