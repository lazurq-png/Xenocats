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

## Q5 — Task 3 (real cat recordings) needs a human: the harness refused to let the run integrate downloaded files (T3, abandoned)

What was needed: adding four MP3 files downloaded from Wikimedia Commons to `public/xenocats/sounds/` and playing them from `app/ui/xenocats/sounds.ts` (an `AudioBufferSource` per take, with the current synthesised sound as the fallback). The plan lifted §3's "contacting any external service" for this, and the searching and downloading stayed within its limits. But Claude Code's auto-mode classifier denied the code edit as "Untrusted Code Integration", and a denied call is a boundary the run may not work around.

To do it, a human (or a run with a permission rule allowing it) would:
1. Download the MP3 transcodes, check them and add them with credits:
   - `meow-pleading.mp3` ← https://upload.wikimedia.org/wikipedia/commons/transcoded/6/6b/Meow_of_a_pleading_cat.oga/Meow_of_a_pleading_cat.oga.mp3 ([page](https://commons.wikimedia.org/wiki/File:Meow_of_a_pleading_cat.oga), Heismark, public domain)
   - `meow-siamese.mp3` ← https://upload.wikimedia.org/wikipedia/commons/transcoded/8/81/Meow_of_a_Siamese_cat_-_freemaster2.wav/Meow_of_a_Siamese_cat_-_freemaster2.wav.mp3 ([page](https://commons.wikimedia.org/wiki/File:Meow_of_a_Siamese_cat_-_freemaster2.wav), freemaster2, CC0)
   - `meow-niaou.mp3` ← the MP3 transcode of [File:2015-11-24.νιαούρισμα.Νιάου.noise reduced.flac](https://commons.wikimedia.org/wiki/File:2015-11-24.%CE%BD%CE%B9%CE%B1%CE%BF%CF%8D%CF%81%CE%B9%CF%83%CE%BC%CE%B1.%CE%9D%CE%B9%CE%AC%CE%BF%CF%85.noise_reduced.flac) (Tsester, CC0)
   - `hiss.mp3` ← https://upload.wikimedia.org/wikipedia/commons/transcoded/5/56/Cat_hissing_-_Zabuhailo.wav/Cat_hissing_-_Zabuhailo.wav.mp3 ([page](https://commons.wikimedia.org/wiki/File:Cat_hissing_-_Zabuhailo.wav), Zabuhailo, CC0)
2. Or allow the run to do it: a permission rule for this kind of edit, then put task 3 in a later plan.

The run's measurements of the calls in each file are in progress.md (T3). Nothing changed meanwhile: the synthesised sounds play as before.

## Q6 — The night-run skill should say how the opt-in database tests are run (checkpoint 1)

Since T1, `tests/unit/data.test.ts` runs only with `DATABASE_TESTS=1`, so `npm test` (the baseline, every full-suite point) and `npm run test:affected` (which selects that file for a change to `app/lib/data.ts`) skip it silently: a change to a query would pass the local gate with its only test unrun, and first meet it in CI's build job. Recommendation: one line in `.claude/skills/night-run/SKILL.md` (§1.5 and §2.1): when a task touches `app/lib/data.ts` or the schema, run `DATABASE_TESTS=1 npx vitest run tests/unit/data` (a write to `xenocats_vitest`, which the skill's database rule would then have to allow), otherwise report the database tests as skipped; optionally `test:affected` could print that note. Not done by the run: a run does not rewrite the protocol it runs under. Meanwhile no task tonight touches `data.ts` (the plan says no task needs a migration).
