// The Survival arena's own artwork, drawn by the run as SVG in the site's palette
// (tailwind.config.ts): the hero, the Keeper. A placeholder until a Superdesign pass.
// The cats are the twenty xenocat types' own artwork (cat-art.ts), unchanged.

const VOID = '#070b14';
const LINE = '#2d2f47';
const AURA = '#9d86ff';
const PLASMA = '#c1e838';
const CREAM = '#e0e0b3';

/** The Keeper: a long dark coat, a pale face under a hood, a laser pointer held out. */
export const HERO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <ellipse cx="32" cy="58" rx="16" ry="4" fill="${VOID}" opacity="0.6"/>
  <path d="M20 54 L24 26 Q32 18 40 26 L44 54 Q32 58 20 54 Z" fill="${LINE}" stroke="${AURA}" stroke-width="2"/>
  <path d="M32 30 L32 54" stroke="${AURA}" stroke-width="1.5" opacity="0.7"/>
  <path d="M21 26 Q32 6 43 26 Q32 20 21 26 Z" fill="${LINE}" stroke="${AURA}" stroke-width="2"/>
  <ellipse cx="32" cy="24" rx="7" ry="6" fill="${CREAM}"/>
  <rect x="27" y="22.5" width="10" height="3" rx="1.5" fill="${VOID}"/>
  <path d="M41 36 L52 33" stroke="${CREAM}" stroke-width="3.5" stroke-linecap="round"/>
  <rect x="50" y="30.5" width="9" height="4" rx="1.5" fill="${AURA}"/>
  <circle cx="59.5" cy="32.5" r="2" fill="${PLASMA}"/>
</svg>`;
