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

`app/lib/login-limit.ts` locks a login name after repeated failures, and (since
the night run of 2026-11-02) a client address after 20 across all names, where a
trusted proxy names the address; spent rows are pruned. Still not covered:

- **Many addresses against one name.** The per-name lock is what stops guessing,
  so anyone with enough addresses can keep a known name locked. Options: a
  growing delay instead of a hard lock, or a lock the account's owner can clear
  (an emailed link: no email is sent today).
- **One address against a few names.** Within its 20, one address can still lock
  four names (5 each) every 15 minutes.
- **No trusted proxy.** Off Vercel without `TRUSTED_PROXY_HEADER` the address
  limit is off (a startup warning says so). Behind a proxy that writes the client's
  port with its address (`203.0.113.7:51234`; Azure's Application Gateway does), the
  address alone is counted (since the night run of 2026-11-02, E32), so the limit holds
  there too.

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
