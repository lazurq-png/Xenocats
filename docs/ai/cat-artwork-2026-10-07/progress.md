# Cat artwork, 2026-10-07

Supervised session, finishing the leftovers of
[`../cat-artwork-2026-10-06/progress.md`](../cat-artwork-2026-10-06/progress.md).
Superdesign project **"Xenocat cats"** (`b121e4aa-a80f-464b-99ef-b581b0582d0c`),
`bytedance/seedream-5.0-lite`, 6 credits an image. The credits had reset to 100;
13 images were generated (78 credits), **22 are left**.

## Done

**All 20 cats now have artwork for both poses**, so every on-screen cat uses it.

| Cat                          | What                                       | Generation id → canvas node                           |
| ---------------------------- | ------------------------------------------ | ----------------------------------------------------- |
| Gravity Manx awake           | regenerated: plain coat, no visible tail   | `d0d50f0f` → (no node id returned)                    |
| Gravity Manx asleep          | regenerated: no tail, plain coat (2nd try) | `9bebd167` → `71529eb4-f080-4e7e-b489-38d4e419e037`   |
| Decoy Burmese asleep         | regenerated: solid sable (2nd try)         | `3073dac0` → `0fc4365c-1845-4d38-8f98-00980523b7b9`   |
| Smoke Bombay awake           | regenerated without the opaque smoke       | `a7bf08aa` → `da122306-342c-42f9-bf9d-673d49d06db0`   |
| Hypno Rex asleep             | new                                        | `72ff1294` → `180e1f4d-90e0-4723-9a89-9d17132cb138`   |
| Pinball Devon awake / asleep | new                                        | `96557ca0` → `fc24f15f-…` / `8df8eacf` → `5d94c479-…` |
| Laser Ocicat awake / asleep  | new                                        | `b53b1a41` → `db9fe5ab-…` / `309e5350` → `8713e9a7-…` |

Discarded (spent, not used): Decoy Burmese asleep 1st try (orange collar patch,
tail rings), Gravity Manx asleep 1st try (still had a wrapped tail).

**Hypno Rex's eyes overlay.** `hypno-rex-eyes.webp` is the awake art cut down to
its two eyes (`eyes.cjs`). `CAT_ART['hypno-rex'].eyes` maps it, `CatSprite` draws
it over the body image as `img.xenocat-eyes` while awake, and the existing
eyes-first / eyes-last CSS stages it apart from the body. Hypno Rex awake was
also re-keyed with `--hole` to clear a white patch between tail and body.

**Keying** (`key.cjs` here, a copy of the 10-06 one plus two options):
`--erode N` shrinks the opaque edge (Laser Ocicat awake `--erode 3` and asleep
`--erode 2`: the model drew a thin olive outline; Gravity Manx asleep
`--erode 2`: a 1 px grey floor line), `--hole x,y` clears an enclosed white area.

## What worked in the prompts

- **Plain coats:** use a plain-coated reference. Style: Decoy Burmese awake
  (`22e731be-2bff-4a10-bfc5-af23cb40d2c9`) instead of Magneto Bengal; asleep
  pose: Smoke Bombay asleep (`5660641a-cf6a-4e9b-b3e5-bcefb06c25b3`) instead of
  Void Tabby. Spell out "no stripes, no tail rings, no lighter or orange patches".
- **Manx asleep:** only a pose reference with a tail ever produced a tail. What
  worked was the awake Manx as the _only_ reference, the pose described in words
  ("a compact round loaf … its round rump showing … no tail anywhere").
- A generated image can be a reference by its `outputUrl` when the generation
  returned no canvas node id.

## Verified

- `npx vitest run tests/unit/xenocats`: 349 passed (new: every cat has both
  poses, eyes-first cats have an overlay, the overlay renders only awake).
- `npx playwright test tests/e2e/cats.spec.ts`: 31 passed (new: Hypno Rex arrives
  with its art and eyes layer).
- `npm run lint` (no warnings), `next typegen && tsc --noEmit`, prettier on the
  changed files.
- **Looked at** `/cats` in `next dev` through Playwright screenshots: the five
  changed gallery cards, Hypno Rex 400 ms into its entrance (only the eyes
  showing) and after it, and the asleep summons of Hypno Rex, Pinball Devon,
  Laser Ocicat and Gravity Manx. Not checked at phone width.

## Follow-up fixes

- **Laser Ocicat asleep** came out striped, not spotted: regenerated (`263ee843`
  → `423c9bb3-93b4-4e17-9bf7-07796e89473f`), "round thumbprint spots, like a
  leopard or ocelot … spots only, no stripes", keyed with `--erode 2`.
- **Pinball Devon asleep** had smaller ears than awake: regenerated (`6c0273ab`
  → `d74a0bd6-fcea-4dda-87f5-9cfd2749d646`), "huge ears, each nearly as tall as
  its head, standing up even while it sleeps".
- **Gravity Manx** was orange (hue ~20°) rather than its golden ochre
  (`#a16207`, ~40°): both poses recoloured without a generation by
  `recolor.cjs … 12` on the keyed files (18° turned it olive). Re-key from the
  source JPG and recolour once if they are ever rebuilt.

Unit tests (`tests/unit/xenocats`) rerun after these.

## Left

Nothing known.
