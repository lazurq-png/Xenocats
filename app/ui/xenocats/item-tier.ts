// How far a weapon or passive has come, as a tier and a colour. One function maps an
// item (and its level) to its tier, and every place the game names one (the level-up
// cards, the pause menu, the results) colours it from here, so they cannot disagree.
//
// Weapons climb by level: 1–2, 3–4, 5–6, 7, 8 (the highest) are tiers 1 to 5; an
// evolved weapon is tier 6 and a fused one tier 7, each a colour of its own beyond the
// highest level's. A passive's levels 1 to 5 are tiers 1 to 5, the same scale.
//
// Colour is never the only signal: the tier's name is written beside the name, with the
// level. The colours are the theme's `tier` tokens (tailwind.config.ts); each keeps the
// text's contrast (WCAG AA, 4.5 : 1) against the dark panels they are drawn on, which
// the 'colour of how far' tests in tests/unit/xenocats/arsenal.test.ts check from the tokens
// themselves.

import {
  EVOLUTIONS,
  FUSIONS,
  MAX_PASSIVE_LEVEL,
  MAX_WEAPON_LEVEL,
  type PassiveId,
  type WeaponId,
} from './arsenal';

export type Tier = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** What each tier is called, in words (the colour is not the only signal). */
export const TIER_NAMES: Readonly<Record<Tier, string>> = {
  1: 'Basic',
  2: 'Fine',
  3: 'Good',
  4: 'Great',
  5: 'Finest',
  6: 'Evolved',
  7: 'Fused',
};

/** The text colour class of each tier: the theme's `tier` tokens, spelt out for Tailwind. */
export const TIER_CLASS: Readonly<Record<Tier, string>> = {
  1: 'text-tier-1',
  2: 'text-tier-2',
  3: 'text-tier-3',
  4: 'text-tier-4',
  5: 'text-tier-5',
  6: 'text-tier-6',
  7: 'text-tier-7',
};

export type TieredItem =
  | { kind: 'weapon'; id: WeaponId; level: number }
  | { kind: 'passive'; id: PassiveId; level: number };

const isFused = (id: WeaponId) => FUSIONS.some((f) => f.to === id);
const isEvolved = (id: WeaponId) => EVOLUTIONS.some((e) => e.to === id);

/** The tier an item is at. */
export function tierOf(item: TieredItem): Tier {
  if (item.kind === 'passive') {
    return Math.min(Math.max(Math.round(item.level), 1), MAX_PASSIVE_LEVEL) as Tier;
  }
  if (isFused(item.id)) return 7;
  if (isEvolved(item.id)) return 6;
  const level = Math.min(Math.max(Math.round(item.level), 1), MAX_WEAPON_LEVEL);
  if (level <= 2) return 1;
  if (level <= 4) return 2;
  if (level <= 6) return 3;
  return level === 7 ? 4 : 5;
}

/** The tier, its name and its colour class, for an item. */
export function tierStyle(item: TieredItem): { tier: Tier; name: string; className: string } {
  const tier = tierOf(item);
  return { tier, name: TIER_NAMES[tier], className: TIER_CLASS[tier] };
}
