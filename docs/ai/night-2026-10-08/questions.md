# Questions — night run 2026-10-08

What needed a human: the question, the options and their consequences, the recommendation, and what was done meanwhile.

## Q1 — Survival on a phone: how much of the arena, and how small may the Keeper be? (T7)

Task 7 asked a phone to see "at least as much of the arena as a desktop shows around him, in the narrower dimension", "without making the Keeper and cats too small to read", and "at desktop sizes nothing changes". The camera measures the browser window, not the screen, and a laptop's window is shorter than its screen: a 1366 × 768 laptop shows about 650 px of height. Built (decisions D41): a phone sees at least 640 arena px across its narrower side (a 390 px phone zooms out 1.64, the Keeper's 64 px sprite drawn at about 39 px), so it sees about as much as the smallest common laptop window, and every desktop window of 650 px or more is unzoomed. Two edges: a window under 640 px tall (a 1366 × 768 laptop with a bookmarks bar and the taskbar, about 600–615 px) zooms out a little, up to about 7%; and the zoom stops at 1.8, so a screen narrower than about 356 px sees less than 640 (a 320 px one, 576).

- (a) Keep 640 (built, on the task branch, merged with it).
- (b) More, e.g. 768 (as much as a 1366 × 768 laptop's whole screen): a 390 px phone zooms out 1.97 (Keeper about 32 px), and laptop windows under 768 px tall zoom out too, 5–20%, so desktop is no longer unchanged.
- (c) Less, for bigger sprites on a phone: a little less warning of cats from the sides.

Recommendation: look at it on a phone. It is one constant, `ARENA_CONFIG.view` in `app/ui/xenocats/arena.ts`, with its unit tests in `tests/unit/xenocats/arena.test.ts` ("the camera on a small screen").
