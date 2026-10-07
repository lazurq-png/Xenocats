// The Survival arena's own artwork, drawn by the run as SVG in the site's palette
// (tailwind.config.ts): the heroes (the Keeper and the characters re-dressed) and
// the varieties of cat. Placeholders until a Superdesign pass. The twenty xenocat
// types keep their own artwork (cat-art.ts), unchanged.

import type { VarietyId } from './varieties';

const VOID = '#070b14';
const LINE = '#2d2f47';
const AURA = '#9d86ff';
const PLASMA = '#c1e838';
const CREAM = '#e0e0b3';

/**
 * A hero: a long coat, a pale face under a hood, an arm held out with `tool` at
 * its end. The Keeper and the characters (progression.ts) are this one, re-dressed.
 */
function heroSvg(o: { coat: string; trim: string; tool: string }): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <ellipse cx="32" cy="58" rx="16" ry="4" fill="${VOID}" opacity="0.6"/>
  <path d="M20 54 L24 26 Q32 18 40 26 L44 54 Q32 58 20 54 Z" fill="${o.coat}" stroke="${o.trim}" stroke-width="2"/>
  <path d="M32 30 L32 54" stroke="${o.trim}" stroke-width="1.5" opacity="0.7"/>
  <path d="M21 26 Q32 6 43 26 Q32 20 21 26 Z" fill="${o.coat}" stroke="${o.trim}" stroke-width="2"/>
  <ellipse cx="32" cy="24" rx="7" ry="6" fill="${CREAM}"/>
  <rect x="27" y="22.5" width="10" height="3" rx="1.5" fill="${VOID}"/>
  <path d="M41 36 L52 33" stroke="${CREAM}" stroke-width="3.5" stroke-linecap="round"/>
  ${o.tool}
</svg>`;
}

/** The heroes, by character (progression.ts): the Keeper, the Night Porter, the Housekeeper. */
export const HERO_SVGS = {
  keeper: heroSvg({
    coat: LINE,
    trim: AURA,
    tool: `<rect x="50" y="30.5" width="9" height="4" rx="1.5" fill="${AURA}"/><circle cx="59.5" cy="32.5" r="2" fill="${PLASMA}"/>`,
  }),
  // A shorter, brighter-trimmed coat, and a spray bottle.
  'night-porter': heroSvg({
    coat: '#12162b',
    trim: PLASMA,
    tool: `<rect x="51" y="27" width="7" height="11" rx="2" fill="#7dd3fc"/><rect x="52.5" y="23" width="4" height="4" fill="${CREAM}"/><path d="M56.5 24 H61" stroke="${CREAM}" stroke-width="2"/>`,
  }),
  // A pale apron over the coat, and the vacuum's nozzle.
  housekeeper: heroSvg({
    coat: '#4b4f6b',
    trim: CREAM,
    tool: `<path d="M28 34 H36 L38 52 H26 Z" fill="${CREAM}" opacity="0.85"/><path d="M52 33 Q58 40 56 50" stroke="${AURA}" stroke-width="3" fill="none"/><rect x="51" y="49" width="10" height="5" rx="2" fill="${LINE}" stroke="${AURA}" stroke-width="1.5"/>`,
  }),
} as const;

/**
 * A sitting cat, front on, in a 64×64 box: body, head, ears, eyes, a tail; `extra`
 * is drawn on top (stripes, a box, a glow). Each variety its own colours.
 */
function catSvg(o: {
  fur: string;
  belly: string;
  eyes: string;
  extra?: string;
  under?: string;
}): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  ${o.under ?? ''}
  <path d="M46 50 Q60 46 56 30" stroke="${o.fur}" stroke-width="5" fill="none" stroke-linecap="round"/>
  <ellipse cx="32" cy="46" rx="15" ry="13" fill="${o.fur}"/>
  <ellipse cx="32" cy="49" rx="8" ry="8" fill="${o.belly}"/>
  <path d="M19 22 L21 8 L28 17 Z M45 22 L43 8 L36 17 Z" fill="${o.fur}"/>
  <path d="M21.5 18 L22.5 12 L26 16 Z M42.5 18 L41.5 12 L38 16 Z" fill="${o.belly}"/>
  <circle cx="32" cy="26" r="12" fill="${o.fur}"/>
  <ellipse cx="27" cy="25" rx="2.6" ry="3.4" fill="${o.eyes}"/>
  <ellipse cx="37" cy="25" rx="2.6" ry="3.4" fill="${o.eyes}"/>
  <path d="M30.5 30 L33.5 30 L32 31.6 Z" fill="${o.belly}"/>
  ${o.extra ?? ''}
</svg>`;
}

/** The varieties' drawings (varieties.ts). Placeholders until a Superdesign pass. */
export const VARIETY_SVG: Readonly<Record<VarietyId, string>> = {
  basic: catSvg({ fur: '#8a8aa0', belly: '#c9c9d6', eyes: PLASMA }),
  zoomies: catSvg({
    fur: '#e8963f',
    belly: '#f6d3a6',
    eyes: CREAM,
    under: `<path d="M2 40 H14 M0 48 H12 M4 56 H14" stroke="${CREAM}" stroke-width="2.5" stroke-linecap="round" opacity="0.7"/>`,
  }),
  hissing: catSvg({
    fur: '#1b1d2b',
    belly: '#3a3d55',
    eyes: '#ef4444',
    extra: `<path d="M26 33 L28 31 L30 33 L32 31 L34 33 L36 31 L38 33" stroke="${CREAM}" stroke-width="1.4" fill="none"/>`,
  }),
  fat: catSvg({
    fur: '#e0d0a8',
    belly: '#f5ecd5',
    eyes: '#5b4a2e',
    extra: `<ellipse cx="32" cy="47" rx="20" ry="15" fill="#e0d0a8" opacity="0.55"/>`,
  }),
  kitten: catSvg({ fur: '#f3f0ea', belly: '#ffd1dc', eyes: AURA }),
  box: catSvg({
    fur: '#6f6f86',
    belly: '#b6b6c8',
    eyes: PLASMA,
    extra: `<path d="M10 38 H54 V60 H10 Z" fill="#b8874f" stroke="#7a5630" stroke-width="2"/><path d="M10 38 L4 30 H22 L26 38 M54 38 L60 30 H42 L38 38" fill="#c99a62" stroke="#7a5630" stroke-width="2"/>`,
  }),
  laser: catSvg({
    fur: '#4b4f6b',
    belly: '#8e93b5',
    eyes: '#ef4444',
    extra: `<rect x="22" y="22" width="20" height="6" rx="3" fill="${VOID}" opacity="0.85"/><circle cx="27" cy="25" r="1.6" fill="#ef4444"/><circle cx="37" cy="25" r="1.6" fill="#ef4444"/>`,
  }),
  possessed: catSvg({
    fur: '#d9dcf2',
    belly: '#f1f2fb',
    eyes: AURA,
    under: `<circle cx="32" cy="34" r="27" fill="${AURA}" opacity="0.18"/>`,
  }),
  // The secret cat: a tuxedo, with someone else's collar.
  neighbour: catSvg({
    fur: '#1b1d2b',
    belly: '#f3f0ea',
    eyes: PLASMA,
    extra: `<path d="M24 36 Q32 40 40 36" stroke="#ef4444" stroke-width="2.5" fill="none"/><circle cx="32" cy="39.5" r="2" fill="${CREAM}"/>`,
  }),
  mega: catSvg({
    fur: '#e8822f',
    belly: '#f8c98f',
    eyes: '#2a1a0a',
    extra: `<path d="M24 16 L26 21 M32 14 V20 M40 16 L38 21 M20 42 Q24 40 22 46 M44 42 Q40 40 42 46" stroke="#a24e12" stroke-width="2.2" stroke-linecap="round" fill="none"/>`,
  }),
};
