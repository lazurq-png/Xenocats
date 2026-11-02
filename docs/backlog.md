# Backlog

Open questions and proposed work carried over from the night runs of
2026-09-25 to 2026-10-09, whose state directories were removed on 2026-10-17
(they are in git history, `docs/ai/night-<date>/`). Each was checked against
the code before it was written here. Newer runs' open items are in their own
`docs/ai/night-<date>/questions.md`.

Remove an entry when it is done or decided.

## Decisions for a human

None open.

## Proposed tasks

### Login lockout: what it does not cover

`app/lib/login-limit.ts` locks an email after repeated failures. Not built:

- a limit per client address, so one source cannot try many emails;
- pruning `login_failures` rows of emails that never log in (an attacker adds
  one row per address they try).

### An index for the searches

The invoice and customer searches match `ILIKE '%term%'`, which no B-tree index
can serve. A trigram index (`pg_trgm`, an extension created per database) would
serve the customers search; the invoice search's `OR` across a join would also
need restructuring (a `UNION` of the two sides, or one indexed text column).
Only worth it if the tables grow large.

## For a human to look at

Built and tested in a browser, but never seen on a real device or by eye:

- **Petting a sleeping cat on an iPhone.** A press held a second on a sleeping
  cat pets it; Chromium's touch emulation passes. On iOS a long press over text
  may start text selection or the callout instead. Summon a cat asleep on
  `/cats` and hold a finger on it. If iOS cancels it: `-webkit-touch-callout:
none` and `user-select: none` on the cat during a hold, or a hold shorter
  than the system's long press (about 500 ms).
- **Survival on a phone.** A phone sees at least 640 arena px across its
  narrower side (a 390 px phone zooms out 1.64), so every desktop window from
  650 px up is unzoomed. Whether the Keeper and cats are big enough to read is
  one constant, `ARENA_CONFIG.view` in `app/ui/xenocats/arena.ts`.
- **Art drawn in code** (canvas, no artwork): the Survival varieties and the
  Purring Cat, the Night Porter, the Housekeeper and the Neighbour's Cat, the
  chests, gems, shots and blades. A candidate for a design pass.
- **Balance.** Every Survival number began as a first guess. One seeded test
  checks that moving beats standing still; nothing checks that the five-minute
  goal can be reached by good play.
