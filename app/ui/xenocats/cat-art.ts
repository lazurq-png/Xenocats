// Rendered artwork for the cats, generated with Canva in the style of the site's
// mockup (public/xenocats/cats/<id>-<pose>.webp, 512×512, transparent). A cat
// without artwork for a pose is drawn by the SVG sprite in cat-sprite.tsx.
//
// The generation plan, prompts and keying script live outside the repo, in the
// Canva reference folder (cats/plan.json, cats/key.js); add a pose here once its
// file is in public/xenocats/cats/. Hypno Rex's eyes-first entrance fades in
// `.xenocat-eyes` before the body, so its artwork will need an eyes overlay.

export type Pose = 'awake' | 'asleep';

export const CAT_ART: Readonly<Record<string, Partial<Record<Pose, string>>>> = {
  'void-tabby': { awake: '/xenocats/cats/void-tabby-awake.webp' },
  'gravi-coon': { awake: '/xenocats/cats/gravi-coon-awake.webp' },
  'pulsar-siamese': { awake: '/xenocats/cats/pulsar-siamese-awake.webp' },
};

/**
 * The artwork for a cat's pose, if there is any. With `wholeSet`, only when the
 * cat has artwork for both poses, so a cat never switches style between sleeping
 * and waking up (the on-screen cats do both; the gallery shows them awake only).
 */
export function catArt(id: string, pose: Pose, { wholeSet = false } = {}): string | undefined {
  const art = CAT_ART[id];
  if (!art) return undefined;
  if (wholeSet && !(art.awake && art.asleep)) return undefined;
  return art[pose];
}
