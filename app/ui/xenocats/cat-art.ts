// Rendered artwork for the cats, generated with Canva (cats 1–9) and the
// Superdesign project "Xenocat cats" (from 10 on) in the style of the site's
// mockup (public/xenocats/cats/<id>-<pose>.webp, 512×512, transparent). A cat
// without artwork for a pose is drawn by the SVG sprite in cat-sprite.tsx.
//
// The Canva plan, prompts and keying script live outside the repo, in the
// Canva reference folder (cats/plan.json, cats/key.js); add a pose here once its
// file is in public/xenocats/cats/. Hypno Rex's eyes-first entrance fades in
// `.xenocat-eyes` before the body, so its artwork will need an eyes overlay.

export type Pose = 'awake' | 'asleep';

export const CAT_ART: Readonly<Record<string, Partial<Record<Pose, string>>>> = {
  'void-tabby': {
    awake: '/xenocats/cats/void-tabby-awake.webp',
    asleep: '/xenocats/cats/void-tabby-asleep.webp',
  },
  'gravi-coon': {
    awake: '/xenocats/cats/gravi-coon-awake.webp',
    asleep: '/xenocats/cats/gravi-coon-asleep.webp',
  },
  'pulsar-siamese': {
    awake: '/xenocats/cats/pulsar-siamese-awake.webp',
    asleep: '/xenocats/cats/pulsar-siamese-asleep.webp',
  },
  'mirror-sphynx': {
    awake: '/xenocats/cats/mirror-sphynx-awake.webp',
    asleep: '/xenocats/cats/mirror-sphynx-asleep.webp',
  },
  'static-calico': {
    awake: '/xenocats/cats/static-calico-awake.webp',
    asleep: '/xenocats/cats/static-calico-asleep.webp',
  },
  'cryo-persian': {
    awake: '/xenocats/cats/cryo-persian-awake.webp',
    asleep: '/xenocats/cats/cryo-persian-asleep.webp',
  },
  'nebula-ragdoll': {
    awake: '/xenocats/cats/nebula-ragdoll-awake.webp',
    asleep: '/xenocats/cats/nebula-ragdoll-asleep.webp',
  },
  'quantum-kitten': {
    awake: '/xenocats/cats/quantum-kitten-awake.webp',
    asleep: '/xenocats/cats/quantum-kitten-asleep.webp',
  },
  'magneto-bengal': {
    awake: '/xenocats/cats/magneto-bengal-awake.webp',
    asleep: '/xenocats/cats/magneto-bengal-asleep.webp',
  },
  'orbit-abyssinian': {
    awake: '/xenocats/cats/orbit-abyssinian-awake.webp',
    asleep: '/xenocats/cats/orbit-abyssinian-asleep.webp',
  },
  'decoy-burmese': {
    awake: '/xenocats/cats/decoy-burmese-awake.webp',
    asleep: '/xenocats/cats/decoy-burmese-asleep.webp',
  },
  'wobble-fold': {
    awake: '/xenocats/cats/wobble-fold-awake.webp',
    asleep: '/xenocats/cats/wobble-fold-asleep.webp',
  },
  'munchkin-mite': {
    awake: '/xenocats/cats/munchkin-mite-awake.webp',
    asleep: '/xenocats/cats/munchkin-mite-asleep.webp',
  },
  'titan-forest-cat': {
    awake: '/xenocats/cats/titan-forest-cat-awake.webp',
    asleep: '/xenocats/cats/titan-forest-cat-asleep.webp',
  },
  'lag-ragamuffin': {
    awake: '/xenocats/cats/lag-ragamuffin-awake.webp',
    asleep: '/xenocats/cats/lag-ragamuffin-asleep.webp',
  },
  'gravity-manx': {
    awake: '/xenocats/cats/gravity-manx-awake.webp',
    asleep: '/xenocats/cats/gravity-manx-asleep.webp',
  },
  'smoke-bombay': {
    awake: '/xenocats/cats/smoke-bombay-awake.webp',
    asleep: '/xenocats/cats/smoke-bombay-asleep.webp',
  },
  // Asleep still to come (and the eyes overlay above): until then the on-screen
  // cat keeps its SVG (wholeSet); the gallery and the fight show this.
  'hypno-rex': {
    awake: '/xenocats/cats/hypno-rex-awake.webp',
  },
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
