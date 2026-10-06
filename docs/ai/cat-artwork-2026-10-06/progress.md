# Cat artwork, 2026-10-06

Supervised session. Artwork generated in the Superdesign project **"Xenocat cats"**
(`b121e4aa-a80f-464b-99ef-b581b0582d0c`) with `bytedance/seedream-5.0-lite`, the
only image model this plan can use: 6 credits an image, 16 images, 96 credits.
**4 credits are left**, so nothing more can be generated until they are topped up.

## Done

Mapped in `app/ui/xenocats/cat-art.ts`, files in `public/xenocats/cats/`:

- Orbit Abyssinian asleep (its set is now whole, so the on-screen cat uses art).
- Both poses: Decoy Burmese, Wobble Fold, Munchkin Mite, Titan Forest Cat,
  Lag Ragamuffin, Gravity Manx, Smoke Bombay.
- Hypno Rex awake only (gallery and fight; the on-screen cat keeps its SVG).

Verified: `npx vitest run tests/unit/xenocats` (346 passed), the 30 tests of
`tests/e2e/cats.spec.ts`, eslint, `prettier --check --end-of-line auto`,
`next typegen && tsc --noEmit`. The new art has **not been looked at in the
running app**, only as separate images.

## For the next Superdesign run

### Problems to fix (regenerate)

1. **Gravity Manx asleep has a long tail.** A Manx has only a stub
   (`tail: 'stub'` in `cat-types.ts`; the awake art is right). It copied the
   wrapped tail from the asleep pose reference. Regenerate with only the awake
   Manx as reference, or say "no tail at all, only a tiny stub, nothing wrapped
   around the body" explicitly.
2. **Faint stripes where the coat should be plain.** Decoy Burmese asleep
   (should be solid sable, as its awake art is) and Gravity Manx, both poses
   (`pattern: 'none'`). The striped Void Tabby / Magneto Bengal references leak
   their markings; a plain-coated reference would avoid it.
3. **Smoke Bombay awake: the smoke wisps are opaque light grey.** The keying
   only clears near-white, so the smoke is solid, not see-through. Look at it
   on the dark site first; fix by keying the smoke to partial alpha or by
   regenerating without smoke (its entrance animation is already smoke).
4. **Hypno Rex** needs its asleep pose, and its eyes-first entrance fades in
   `.xenocat-eyes` before the body, so it needs a separate eyes overlay before
   the on-screen cat can use art (see the comment at the top of `cat-art.ts`).

### Still missing

- Pinball Devon and Laser Ocicat, both poses; Hypno Rex asleep. 5 images,
  30 credits. Plus the regenerations above (Manx asleep at least: 6 credits).

### Look at in the running app

`npm run dev`, then `/cats`: every new cat in the gallery, summoned awake and
asleep, on the dark background, especially Smoke Bombay's smoke and the edges
of the light-coated cats (Lag Ragamuffin, Wobble Fold, Munchkin Mite) for a
white fringe.

### How it was done (reuse it)

- Canvas reference nodes already uploaded, usable with `--reference <node>`:
  sitting style `5ee3e561-4fe5-4fb3-952d-40c904611c87` (Magneto Bengal awake),
  asleep pose `2f2f5220-3042-4166-90a0-7a095af23cc1` (Void Tabby asleep).
  Each generated image is also a canvas node; their ids are in the project.
- Awake: `generate-image --aspect-ratio 1:1 --reference <sitting style>` with
  "<description>. Sitting upright facing the viewer, front paws together, tail
  curled at its side, filling most of the square frame." plus the style line.
- Asleep: the cat's own awake node first, the asleep pose node second: "The same
  cat as the first reference image, keeping its exact colours, markings, ears
  and build, now curled up asleep in the pose and framing of the second
  reference image: lying low at the bottom of the frame, eyes closed, paws
  tucked under the chin, tail wrapped around." plus the style line.
- Style line: "Soft stylised 3D render, cute and slightly alien, detailed fur,
  same art style and lighting as the reference image. Single cat, centered,
  plain pure white background, no shadow, no props, no text."
- Output is a 1920×1920 JPG on white. `key.cjs` (this directory) resizes it to
  512×512 and flood-fills the white from the border to transparent. Light fur
  touching the edge can be eaten: Wobble Fold asleep needed `HARD = 14`,
  `SOFT = 50` instead of 40 / 90.
- `confirm-generation` times out after 30 s but the generation carries on;
  follow it with `get-generation <id> --wait`, never a new quote.
- Every generation spends credits: quote first (free) and get approval.
