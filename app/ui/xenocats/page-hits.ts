// Which page elements a cat's attack hits, around the pointer (or, on a touch
// screen, the last touch). Each hit element is then attacked as the cursor is: it
// becomes a puppet (puppets.ts) that does what the attack does to a pointer held
// still where it stands, and nothing else. How many elements are hit and how far
// they go depends on the cat intensity (intensity.ts):
//
//   calm     a few elements near the pointer (buttons, links, text, cards, table
//            rows, inputs), thrown half as far as the cursor would be.
//   normal   more elements, whole panels (frames) and a few anywhere on screen,
//            thrown as far as the cursor.
//   chaos    most of the screen, thrown much further (but never off it).
//
// It all reverts exactly when the attack ends (puppets.ts puts each `style`
// attribute back as it was). Text is never touched, and the field being typed in
// is never hit at all.

import { CAT_CONFIG } from './config';
import type { Vec } from './effects';
import type { Intensity } from './intensity';
import type { Random } from './random';

/** How far an attack reaches on the page. */
export type HitReach = {
  /** Elements this near the pointer, px, and at most this many of them. */
  radius: number;
  max: number;
  /** As many again, picked anywhere on screen. */
  anywhere: number;
  /** Whole panels (`data-xenocat-frame`) can be hit too. */
  frames: boolean;
};

/** What each cat intensity does to the page. */
export type HitLevel = {
  reach: HitReach;
  /**
   * Every hit element is attacked as the cursor is (puppets.ts), its
   * displacement, for an attack that throws the pointer some way from where it
   * is (`amplify: 'offset'`), multiplied by `fling` (by `frameFling` for a whole
   * panel), and its size kept within `scale`.
   */
  puppets: {
    fling: number;
    frameFling: number;
    scale: readonly [number, number];
  };
};

export const HIT_LEVELS: Readonly<Record<Intensity, HitLevel>> = {
  calm: {
    reach: {
      radius: CAT_CONFIG.pageHitRadius,
      max: CAT_CONFIG.maxPageTargets,
      anywhere: 0,
      frames: false,
    },
    puppets: { fling: 0.5, frameFling: 0.5, scale: [0.5, 1.6] },
  },
  normal: {
    reach: { radius: 220, max: 8, anywhere: 4, frames: true },
    puppets: { fling: 1, frameFling: 0.5, scale: [0.25, 2] },
  },
  chaos: {
    reach: { radius: 400, max: 14, anywhere: 12, frames: true },
    puppets: { fling: 2.5, frameFling: 1.5, scale: [0.1, 4] },
  },
};

/** What a page element can be hit as: the ones that look like controls, text or cards. */
export const HIT_SELECTOR = [
  'a[href]',
  'button',
  'input',
  'select',
  'textarea',
  'label',
  'h1',
  'h2',
  'h3',
  'h4',
  'p',
  'li',
  // Rows, not their cells: a cell is always as near as its row and smaller, so
  // with cells listed no row would ever be hit.
  'tr',
  '[data-xenocat-card]',
].join(',');

/** A whole panel (a chart, a table, a form, the side bar): hit only above calm. */
export const FRAME_SELECTOR = '[data-xenocat-frame]';

/** Never hit: the cats, the cursor, the game overlay and anything hidden from AT. */
export const IGNORE_SELECTOR = '[aria-hidden="true"], [data-xenocat-ignore]';

export type Rect = { left: number; top: number; right: number; bottom: number };

/** How far `point` is from the nearest edge of `rect`; 0 inside it. */
export function distanceToRect(point: Vec, rect: Rect): number {
  const dx = Math.max(rect.left - point.x, 0, point.x - rect.right);
  const dy = Math.max(rect.top - point.y, 0, point.y - rect.bottom);
  return Math.hypot(dx, dy);
}

export type Candidate<T> = { item: T; rect: Rect };

/**
 * The elements an attack hits: within `radius` of the pointer, nearest first (the
 * smaller of two equally near), at most `max`, and never one inside another that
 * is already hit (their effects would add up). `contains(a, b)` says whether `a`
 * contains `b`.
 */
export function selectTargets<T>(
  candidates: readonly Candidate<T>[],
  pointer: Vec,
  radius: number,
  max: number,
  contains: (a: T, b: T) => boolean
): T[] {
  const area = (r: Rect) => (r.right - r.left) * (r.bottom - r.top);
  const near = candidates
    .map((c) => ({ ...c, distance: distanceToRect(pointer, c.rect) }))
    // Anything under 2 × 2 px is hidden (e.g. a screen-reader-only label).
    .filter(
      (c) =>
        c.distance <= radius && c.rect.right - c.rect.left >= 2 && c.rect.bottom - c.rect.top >= 2
    )
    .sort((a, b) => a.distance - b.distance || area(a.rect) - area(b.rect));
  const picked: T[] = [];
  for (const c of near) {
    if (picked.length >= max) break;
    if (picked.some((p) => contains(p, c.item) || contains(c.item, p))) continue;
    picked.push(c.item);
  }
  return picked;
}

/**
 * `count` more elements from anywhere in the viewport, at random: none already
 * `picked`, and none inside one picked or around it.
 */
export function pickAnywhere<T>(
  candidates: readonly Candidate<T>[],
  picked: readonly T[],
  count: number,
  viewport: { width: number; height: number },
  contains: (a: T, b: T) => boolean,
  random: Random
): T[] {
  const pool = candidates
    .filter(
      ({ rect }) =>
        rect.right - rect.left >= 2 &&
        rect.bottom - rect.top >= 2 &&
        rect.right > 0 &&
        rect.bottom > 0 &&
        rect.left < viewport.width &&
        rect.top < viewport.height
    )
    .map((c) => c.item);
  const taken = [...picked];
  const extra: T[] = [];
  while (extra.length < count && pool.length > 0) {
    const [item] = pool.splice(random.int(0, pool.length - 1), 1);
    if (taken.some((p) => p === item || contains(p, item) || contains(item, p))) continue;
    taken.push(item);
    extra.push(item);
  }
  return extra;
}

function containsFocusedField(element: Element): boolean {
  const active = element.ownerDocument.activeElement;
  return (
    active !== null &&
    element.contains(active) &&
    active.matches('input, select, textarea, [contenteditable]:not([contenteditable="false"])')
  );
}

/**
 * The page elements an attack at `pointer` hits, as far as `reach` goes: the ones
 * near the pointer, then (if it reaches anywhere) others picked at random on screen.
 */
export function pickTargets(
  root: ParentNode,
  pointer: Vec,
  reach: HitReach,
  random: Random
): HTMLElement[] {
  const selector = reach.frames ? `${HIT_SELECTOR},${FRAME_SELECTOR}` : HIT_SELECTOR;
  const candidates = Array.from(root.querySelectorAll<HTMLElement>(selector))
    .filter((element) => !element.closest(IGNORE_SELECTOR))
    // The field being typed in is left alone altogether, not just its text.
    .filter((element) => !containsFocusedField(element))
    .map((element) => ({ item: element, rect: element.getBoundingClientRect() }));
  const contains = (a: HTMLElement, b: HTMLElement) => a !== b && a.contains(b);
  const near = selectTargets(candidates, pointer, reach.radius, reach.max, contains);
  if (reach.anywhere === 0) return near;
  const viewport = { width: window.innerWidth, height: window.innerHeight };
  return [...near, ...pickAnywhere(candidates, near, reach.anywhere, viewport, contains, random)];
}
