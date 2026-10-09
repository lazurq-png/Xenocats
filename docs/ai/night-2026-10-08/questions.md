# Questions — night run 2026-10-08

What needed a human: the question, the options and their consequences, the recommendation, and what was done meanwhile.

## Q1 — Survival on a phone: how much of the arena, and how small may the Keeper be? (T7)

Task 7 asked a phone to see "at least as much of the arena as a desktop shows around him, in the narrower dimension", "without making the Keeper and cats too small to read", and "at desktop sizes nothing changes". The camera measures the browser window, not the screen, and a laptop's window is shorter than its screen: a 1366 × 768 laptop shows about 650 px of height. Built (decisions D41): a phone sees at least 640 arena px across its narrower side (a 390 px phone zooms out 1.64, the Keeper's 64 px sprite drawn at about 39 px), so it sees about as much as the smallest common laptop window, and every desktop window of 650 px or more is unzoomed. Two edges: a window under 640 px tall (a 1366 × 768 laptop with a bookmarks bar and the taskbar, about 600–615 px) zooms out a little, up to about 7%; and the zoom stops at 1.8, so a screen narrower than about 356 px sees less than 640 (a 320 px one, 576).

- (a) Keep 640 (built, on the task branch, merged with it).
- (b) More, e.g. 768 (as much as a 1366 × 768 laptop's whole screen): a 390 px phone zooms out 1.97 (Keeper about 32 px), and laptop windows under 768 px tall zoom out too, 5–20%, so desktop is no longer unchanged.
- (c) Less, for bigger sprites on a phone: a little less warning of cats from the sides.

Recommendation: look at it on a phone. It is one constant, `ARENA_CONFIG.view` in `app/ui/xenocats/arena.ts`, with its unit tests in `tests/unit/xenocats/arena.test.ts` ("the camera on a small screen").

## Q2 — Petting a sleeping cat on a real phone (T8)

Built and tested in Chromium's touch emulation: a press held a second on a sleeping cat pets it; a quick tap wakes it, angry (decisions D43–D45). Not testable there: a phone's own long-press gestures. On Android Chrome the context menu is suppressed and petting should work; on an iPhone, a long press over text or a link may start text selection, the callout or a link preview, which cancels the press, so the cat would be neither petted nor woken.

- (a) Check on an iPhone and an Android phone: summon a cat asleep on `/cats` and hold a finger on it.
- (b) If iOS cancels it, the cats' layer could take `-webkit-touch-callout: none` / `user-select: none` on the cat's own element during a hold, or the hold could be shorter than the system's long press (about 500 ms): both are small, separate changes.

Recommendation: (a) first.

## Q3 — The development database needs migration 0005 before the dashboard works (T11)

The run never writes to `xenocats` (the plan and the skill forbid it). Until a human runs `npm run db:migrate` there, the development app's dashboard fails: every query now filters on `customers.owner_id`, which that schema does not have yet. The browser tests, the database tests and CI build their own schemas and are not affected.

- `xenocats` has exactly one user (the demo login, unless someone added one): `npm run db:migrate` gives every customer to that user and is done.
- It has more than one user: the migration stops and changes nothing. Its comment (`db/migrations/0005_customer_owners.sql`) gives the two statements to assign owners by hand; then run `npm run db:migrate` again.

Also: every existing login is signed out once (the session must now carry the user's id; D52).

Recommendation: run `npm run db:migrate` this morning.

## Q4 — Task 12 (sign-up) was not started

The goal time (2026-10-09 07:00) had passed when the run resumed at 09:12, after the usage limit had stopped the first session at 18:24. T11 was in flight and was finished (§8.4). T12 is still to do, and its proposals (a limit on sign-ups, email verification, deleting an account) were never written. T11 is the prerequisite it needed; it is merged.

Recommendation: put task 12 in the next plan as written.

## Q5 — `login-limit.spec.ts` "a successful login starts the count again" fails about 1 run in 4 under `next start` (found at T11's gate)

Against `next start` it failed in T11's full gate run, 1 of 5 runs alone, and **3 of 10 runs on the base commit without T11** (`3973479`), so it is older than tonight's work. Under `next dev` it passed every time. The failure: after the first successful login the test calls `page.context().clearCookies()`, and its next `/login` lands on the dashboard (the test user's own, empty), so the next `fill` waits for an Email field that is not there until the 90 s timeout. The likely cause is a response still in flight from the dashboard (the session is refreshed on requests that pass `proxy.ts`), which sets the session cookie again after the clear. The fix is in the test: wait for the dashboard to settle (`waitForLoadState('networkidle')`) before clearing, or sign out with the button rather than clearing cookies. Not done tonight (past the goal, and outside task 11).

Recommendation: a small task in the next plan; confirm it with `E2E_SERVER=start npx playwright test tests/e2e/login-limit -g "starts the count again" --repeat-each 10`.
