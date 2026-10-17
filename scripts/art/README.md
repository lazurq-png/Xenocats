# Cat artwork tools

How the cats' artwork in `public/xenocats/cats/` was made, and the scripts that
turned generated images into it. Each cat has an awake and an asleep pose,
512 × 512 transparent WebP (`app/ui/xenocats/cat-art.ts` maps them).

The scripts use `sharp`, which comes with Next (no dependency of their own).
Run them from the repository root.

| Script                                                                                      | What it does                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `key.cjs <in.jpg> <out.webp> [--erode N] [--hole x,y]...`                                   | Removes the near-white background connected to the border (flood fill), feathers the edge, and writes 512 × 512. `--hole x,y` also clears a white area the cat encloses (between tail and body), seeded at that point of the output; `--erode N` shrinks the opaque edge by N px, removing an outline or floor line the model drew. |
| `recolor.cjs <in.webp> <out.webp> <degrees>`                                                | Turns orange fur toward yellow by rotating hues near orange, leaving pink noses and green eyes alone. Run it once on `key.cjs`'s output: running it again shifts the colour again.                                                                                                                                                  |
| `fur.cjs measure <image.webp>...`                                                           | A cat's fur colour (average hue, saturation and lightness of its colourful, mid-light pixels), to compare one pose with the other.                                                                                                                                                                                                  |
| `fur.cjs adjust <in.webp> <out.webp> <hueFrom> <hueTo> <lightness> [saturation] [hueShift]` | Scales the lightness (and the saturation, and turns the hue) of the fur in a hue band, to match one pose to the other. Rebuild from the original, not from an adjusted image.                                                                                                                                                       |
| `eyes.cjs`                                                                                  | Cuts Hypno Rex's two spiral eyes out of its awake art into `hypno-rex-eyes.webp`, the overlay for its eyes-first entrance. The eye centres are measured on `hypno-rex-awake.webp`: measure again if that image changes.                                                                                                             |

## Generating a cat

The art was generated in the Superdesign project "Xenocat cats"
(`b121e4aa-a80f-464b-99ef-b581b0582d0c`) with `bytedance/seedream-5.0-lite`, at
6 credits an image. Every generation spends credits: get a quote first (free)
and approval. `confirm-generation` times out after 30 s while the generation
carries on, so follow it with `get-generation <id> --wait`, not a new quote.

- **Awake:** `generate-image --aspect-ratio 1:1 --reference <style node>`, with
  "<description>. Sitting upright facing the viewer, front paws together, tail
  curled at its side, filling most of the square frame." and the style line.
- **Asleep:** the cat's own awake image as the first reference, a pose
  reference second: "The same cat as the first reference image, keeping its
  exact colours, markings, ears and build, now curled up asleep in the pose and
  framing of the second reference image: lying low at the bottom of the frame,
  eyes closed, paws tucked under the chin, tail wrapped around." and the style
  line.
- **Style line:** "Soft stylised 3D render, cute and slightly alien, detailed
  fur, same art style and lighting as the reference image. Single cat,
  centered, plain pure white background, no shadow, no props, no text."

Reference nodes on the canvas:

| Use                                                  | Node                                   |
| ---------------------------------------------------- | -------------------------------------- |
| Sitting style, patterned coat (Magneto Bengal awake) | `5ee3e561-4fe5-4fb3-952d-40c904611c87` |
| Sitting style, plain coat (Decoy Burmese awake)      | `22e731be-2bff-4a10-bfc5-af23cb40d2c9` |
| Asleep pose, patterned coat (Void Tabby asleep)      | `2f2f5220-3042-4166-90a0-7a095af23cc1` |
| Asleep pose, plain coat (Smoke Bombay asleep)        | `5660641a-cf6a-4e9b-b3e5-bcefb06c25b3` |

A generated image can also be a reference by its `outputUrl` when the
generation returned no node id.

## What went wrong, and what fixed it

- **Markings leak from the reference.** A striped reference gave plain-coated
  cats faint stripes. Use a plain-coated reference, and spell out "no stripes,
  no tail rings, no lighter or orange patches". The reverse too: Laser Ocicat
  came out striped until the prompt said "round thumbprint spots, like a
  leopard or ocelot … spots only, no stripes".
- **The pose reference's tail is copied.** A Manx kept getting a wrapped tail.
  What worked: the awake Manx as the only reference, and the pose in words ("a
  compact round loaf … its round rump showing … no tail anywhere").
- **Features drift between poses.** Pinball Devon asleep had smaller ears until
  the prompt said "huge ears, each nearly as tall as its head, standing up even
  while it sleeps". Measure both poses with `fur.cjs` when the colours look off.
- **Keying.** The output is a 1920 × 1920 JPG on white. Light fur touching the
  edge can be eaten: lower `HARD` / `SOFT` in `key.cjs` (Wobble Fold asleep
  needed 14 / 50 instead of 40 / 90). Smoke or other near-white parts come out
  solid, not see-through.
- **Colour.** Gravity Manx came out orange (~20°) instead of golden ochre
  (`#a16207`, ~40°): `recolor.cjs … 12` fixed it without a new generation (18°
  turned it olive).

Look at every new cat on the dark site afterwards (`npm run dev`, `/cats`),
summoned awake and asleep, for a white fringe on light coats.
