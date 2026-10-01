// The roster: each cat type pairs an attack effect with its look and its ways of
// arriving and leaving. Entrances and exits name CSS animations in global.css
// (`xenocat-enter-<name>` / `xenocat-exit-<name>`).

import {
  type Effect,
  axisLock,
  blur,
  bounce,
  decoys,
  delay,
  drift,
  drunk,
  fall,
  freeze,
  giant,
  heavy,
  jitter,
  knockback,
  magnet,
  orbit,
  reverse,
  spiral,
  teleport,
  tiny,
  vanish,
} from './effects';

export type CatPalette = {
  /** Fur. */
  body: string;
  /** Belly, inner ears and muzzle. */
  belly: string;
  /** Eyes, antenna tips and some markings. */
  glow: string;
  /** Stripes, points, patches and outline accents. */
  accent: string;
};

/** What the shared sprite draws for this cat (cat-sprite.tsx). */
export type CatLook = {
  build: 'sleek' | 'fluffy' | 'stocky';
  ears: 'pointed' | 'tufted' | 'folded' | 'big';
  pattern: 'none' | 'stripes' | 'spots' | 'patches' | 'points' | 'wrinkles' | 'frost' | 'stars';
  /** Only the first three cats still have one. */
  antenna: 'none' | 'single' | 'double' | 'orb' | 'zigzag';
  eyes: 'slit' | 'round' | 'three' | 'spiral' | 'visor';
  /** A Manx has only a stub. */
  tail?: 'long' | 'stub';
};

export type CatType = {
  id: string;
  /** Its number in the plan's roster, 1–20. */
  number: number;
  name: string;
  effect: Effect;
  palette: CatPalette;
  look: CatLook;
  /** How it arrives: `xenocat-enter-<entrance>`. */
  entrance: string;
  entranceMs: number;
  /** How it leaves: `xenocat-exit-<exit>`. */
  exit: string;
  exitMs: number;
  /** Shakes the page as it arrives and leaves (Titan Forest Cat's stomp). */
  shake?: boolean;
};

export const CAT_TYPES: readonly CatType[] = [
  {
    id: 'void-tabby',
    number: 1,
    name: 'Void Tabby',
    effect: vanish,
    palette: { body: '#3b3552', belly: '#6d6590', glow: '#a78bfa', accent: '#16131f' },
    look: { build: 'sleek', ears: 'pointed', pattern: 'stripes', antenna: 'single', eyes: 'slit' },
    entrance: 'black-hole',
    entranceMs: 1000,
    exit: 'collapse',
    exitMs: 700,
  },
  {
    id: 'gravi-coon',
    number: 2,
    name: 'Gravi Coon',
    effect: heavy,
    palette: { body: '#8a6d4b', belly: '#d9c2a0', glow: '#fbbf24', accent: '#3f2f1f' },
    look: { build: 'fluffy', ears: 'tufted', pattern: 'stripes', antenna: 'double', eyes: 'round' },
    entrance: 'thud',
    entranceMs: 900,
    exit: 'sink',
    exitMs: 800,
  },
  {
    id: 'pulsar-siamese',
    number: 3,
    name: 'Pulsar Siamese',
    effect: knockback,
    palette: { body: '#efe6d8', belly: '#fffaf2', glow: '#38bdf8', accent: '#5b4636' },
    look: { build: 'sleek', ears: 'big', pattern: 'points', antenna: 'orb', eyes: 'slit' },
    entrance: 'pulse',
    entranceMs: 800,
    exit: 'pulse-out',
    exitMs: 600,
  },
  {
    id: 'mirror-sphynx',
    number: 4,
    name: 'Mirror Sphynx',
    effect: reverse,
    palette: { body: '#e8c9c1', belly: '#f7e3de', glow: '#c4b5fd', accent: '#8b6f68' },
    look: { build: 'sleek', ears: 'big', pattern: 'wrinkles', antenna: 'none', eyes: 'round' },
    entrance: 'mirror',
    entranceMs: 900,
    exit: 'shatter',
    exitMs: 700,
  },
  {
    id: 'static-calico',
    number: 5,
    name: 'Static Calico',
    effect: jitter,
    palette: { body: '#f5f0e6', belly: '#ffffff', glow: '#f59e0b', accent: '#262626' },
    look: { build: 'stocky', ears: 'pointed', pattern: 'patches', antenna: 'none', eyes: 'slit' },
    entrance: 'static',
    entranceMs: 800,
    exit: 'static-out',
    exitMs: 700,
  },
  {
    id: 'cryo-persian',
    number: 6,
    name: 'Cryo Persian',
    effect: freeze,
    palette: { body: '#dbeafe', belly: '#f8fafc', glow: '#22d3ee', accent: '#3b82f6' },
    look: { build: 'fluffy', ears: 'folded', pattern: 'frost', antenna: 'none', eyes: 'round' },
    entrance: 'crystal',
    entranceMs: 1000,
    exit: 'melt',
    exitMs: 900,
  },
  {
    id: 'nebula-ragdoll',
    number: 7,
    name: 'Nebula Ragdoll',
    effect: drift,
    palette: { body: '#4c3d75', belly: '#a78bda', glow: '#f0abfc', accent: '#2a1f47' },
    look: { build: 'fluffy', ears: 'pointed', pattern: 'stars', antenna: 'none', eyes: 'three' },
    entrance: 'condense',
    entranceMs: 1100,
    exit: 'dissipate',
    exitMs: 900,
  },
  {
    id: 'quantum-kitten',
    number: 8,
    name: 'Quantum Kitten',
    effect: teleport,
    palette: { body: '#99f6e4', belly: '#f0fdfa', glow: '#2dd4bf', accent: '#115e59' },
    look: { build: 'sleek', ears: 'big', pattern: 'none', antenna: 'none', eyes: 'three' },
    entrance: 'blink',
    entranceMs: 900,
    exit: 'blink-out',
    exitMs: 600,
  },
  {
    id: 'magneto-bengal',
    number: 9,
    name: 'Magneto Bengal',
    effect: magnet,
    palette: { body: '#e3a857', belly: '#fbe7c6', glow: '#ef4444', accent: '#4a2c12' },
    look: { build: 'sleek', ears: 'pointed', pattern: 'spots', antenna: 'none', eyes: 'slit' },
    entrance: 'slide-edge',
    entranceMs: 900,
    exit: 'slide-off',
    exitMs: 800,
  },
  {
    id: 'orbit-abyssinian',
    number: 10,
    name: 'Orbit Abyssinian',
    effect: orbit,
    palette: { body: '#c0773f', belly: '#eecfa8', glow: '#fde047', accent: '#5c2f12' },
    look: { build: 'sleek', ears: 'big', pattern: 'stripes', antenna: 'none', eyes: 'round' },
    entrance: 'spiral',
    entranceMs: 1100,
    exit: 'spiral-out',
    exitMs: 900,
  },
  {
    id: 'decoy-burmese',
    number: 11,
    name: 'Decoy Burmese',
    effect: decoys,
    palette: { body: '#5b3a29', belly: '#8c6a55', glow: '#facc15', accent: '#2b1a10' },
    look: { build: 'stocky', ears: 'pointed', pattern: 'none', antenna: 'none', eyes: 'round' },
    entrance: 'shadow-split',
    entranceMs: 900,
    exit: 'shadow-merge',
    exitMs: 800,
  },
  {
    id: 'wobble-fold',
    number: 12,
    name: 'Wobble Fold',
    effect: drunk,
    palette: { body: '#9ca3af', belly: '#e5e7eb', glow: '#fb923c', accent: '#374151' },
    look: { build: 'fluffy', ears: 'folded', pattern: 'stripes', antenna: 'none', eyes: 'round' },
    entrance: 'tumble',
    entranceMs: 1000,
    exit: 'roll-away',
    exitMs: 900,
  },
  {
    id: 'munchkin-mite',
    number: 13,
    name: 'Munchkin Mite',
    effect: tiny,
    palette: { body: '#f9a8d4', belly: '#fdf2f8', glow: '#a3e635', accent: '#831843' },
    look: { build: 'stocky', ears: 'big', pattern: 'spots', antenna: 'none', eyes: 'round' },
    entrance: 'grow-dot',
    entranceMs: 800,
    exit: 'shrink',
    exitMs: 600,
  },
  {
    id: 'titan-forest-cat',
    number: 14,
    name: 'Titan Forest Cat',
    effect: giant,
    palette: { body: '#6b4f3a', belly: '#c8b39a', glow: '#84cc16', accent: '#2d1f14' },
    look: { build: 'fluffy', ears: 'tufted', pattern: 'patches', antenna: 'none', eyes: 'slit' },
    entrance: 'stomp',
    entranceMs: 900,
    exit: 'stomp-out',
    exitMs: 800,
    shake: true,
  },
  {
    id: 'lag-ragamuffin',
    number: 15,
    name: 'Lag Ragamuffin',
    effect: delay,
    palette: { body: '#e7dccb', belly: '#faf6ef', glow: '#60a5fa', accent: '#7c6a55' },
    look: { build: 'fluffy', ears: 'pointed', pattern: 'points', antenna: 'none', eyes: 'round' },
    entrance: 'slow-motion',
    entranceMs: 1800,
    exit: 'slow-fade',
    exitMs: 1600,
  },
  {
    id: 'gravity-manx',
    number: 16,
    name: 'Gravity Manx',
    effect: fall,
    palette: { body: '#a16207', belly: '#fde68a', glow: '#bef264', accent: '#422006' },
    look: {
      build: 'stocky',
      ears: 'pointed',
      pattern: 'none',
      antenna: 'none',
      eyes: 'slit',
      tail: 'stub',
    },
    entrance: 'beam-down',
    entranceMs: 1300,
    exit: 'beam-up',
    exitMs: 1100,
  },
  {
    id: 'smoke-bombay',
    number: 17,
    name: 'Smoke Bombay',
    effect: blur,
    palette: { body: '#18181b', belly: '#3f3f46', glow: '#f97316', accent: '#000000' },
    look: { build: 'sleek', ears: 'pointed', pattern: 'none', antenna: 'none', eyes: 'round' },
    entrance: 'smoke',
    entranceMs: 1100,
    exit: 'poof',
    exitMs: 700,
  },
  {
    id: 'hypno-rex',
    number: 18,
    name: 'Hypno Rex',
    effect: spiral,
    palette: { body: '#c4b5fd', belly: '#ede9fe', glow: '#f472b6', accent: '#4c1d95' },
    look: { build: 'sleek', ears: 'big', pattern: 'none', antenna: 'none', eyes: 'spiral' },
    entrance: 'eyes-first',
    entranceMs: 1400,
    exit: 'eyes-last',
    exitMs: 1200,
  },
  {
    id: 'pinball-devon',
    number: 19,
    name: 'Pinball Devon',
    effect: bounce,
    palette: { body: '#94a3b8', belly: '#e2e8f0', glow: '#22c55e', accent: '#1e293b' },
    look: { build: 'stocky', ears: 'big', pattern: 'stripes', antenna: 'none', eyes: 'round' },
    entrance: 'bounce-in',
    entranceMs: 1100,
    exit: 'bounce-off',
    exitMs: 900,
  },
  {
    id: 'laser-ocicat',
    number: 20,
    name: 'Laser Ocicat',
    effect: axisLock,
    palette: { body: '#d6b98c', belly: '#f5ead6', glow: '#ef4444', accent: '#3b2a17' },
    look: { build: 'sleek', ears: 'pointed', pattern: 'spots', antenna: 'none', eyes: 'visor' },
    entrance: 'laser-in',
    entranceMs: 1000,
    exit: 'laser-out',
    exitMs: 800,
  },
];

export function catTypeById(id: string): CatType | undefined {
  return CAT_TYPES.find((type) => type.id === id);
}
