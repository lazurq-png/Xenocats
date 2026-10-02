// What a cat's attack does to the page around the pointer. Which elements it hits
// and how depends on the cat intensity (intensity.ts):
//
//   calm     the elements near the pointer (buttons, links, text, cards, table
//            rows, inputs) get an effect matched to the attack — a shake, tilt,
//            blur, flip or glow, a push, or scrambled or swapped text.
//   normal   more elements, whole panels (frames) and a few anywhere on screen are
//            attacked the way the cursor is: each becomes a puppet of the mouse
//            under the cat's effect (puppets.ts). Scrambled or swapped text too.
//   chaos    most of the screen, flung much further: things fly off the page.
//
// It all reverts exactly when the attack ends.
//
// How it stays reversible: an effect only adds `data-xenocat-hit*` attributes and
// a few `--xenocat-hit-*` custom properties, which CSS rules in global.css turn
// into the effect. The restore function puts the `style` attribute back exactly as
// it was (absent stays absent) and removes the attributes. Text is never
// rewritten: scrambled or swapped text is drawn by a `::after` whose CSS alt text
// is empty, over the real text made transparent, so assistive technology reads
// the real text throughout. A focused or editable field is never given text.

import { CAT_CONFIG } from './config';
import type { Vec } from './effects';
import type { Intensity } from './intensity';
import type { Random } from './random';

export type HitKind =
  'shake' | 'wobble' | 'tilt' | 'blur' | 'flip' | 'glow' | 'push' | 'scramble' | 'swap';

export type HitStyle = {
  kind: HitKind;
  /** shake/wobble/blur: px or deg; tilt: deg; push: px. */
  amount?: number;
  /** push: away from the cat, towards it, or a fixed direction. */
  direction?: 'away' | 'toward' | 'down' | 'up' | 'sideways';
  /** glow: a CSS colour. */
  color?: string;
};

/** Each attack's (and combo's) effect on the page when calm, keyed by effect id. */
export const PAGE_HITS: Readonly<Record<string, HitStyle>> = {
  vanish: { kind: 'blur', amount: 6 },
  heavy: { kind: 'push', amount: 18, direction: 'down' },
  knockback: { kind: 'push', amount: 40, direction: 'away' },
  reverse: { kind: 'flip' },
  jitter: { kind: 'shake', amount: 3 },
  freeze: { kind: 'glow', color: '#7dd3fc' },
  drift: { kind: 'push', amount: 24, direction: 'away' },
  teleport: { kind: 'swap' },
  magnet: { kind: 'push', amount: 30, direction: 'toward' },
  orbit: { kind: 'tilt', amount: 12 },
  decoys: { kind: 'scramble' },
  drunk: { kind: 'wobble', amount: 6 },
  tiny: { kind: 'shake', amount: 1.5 },
  giant: { kind: 'shake', amount: 6 },
  delay: { kind: 'blur', amount: 2 },
  fall: { kind: 'push', amount: 40, direction: 'down' },
  blur: { kind: 'blur', amount: 4 },
  spiral: { kind: 'tilt', amount: 25 },
  bounce: { kind: 'push', amount: 20, direction: 'up' },
  'axis-lock': { kind: 'push', amount: 30, direction: 'sideways' },
  // The combos (combos.ts), each from its two attacks.
  'ice-puck': { kind: 'glow', color: '#7dd3fc' },
  slingshot: { kind: 'push', amount: 50, direction: 'away' },
  hangover: { kind: 'wobble', amount: 10 },
  'ghost-jump': { kind: 'swap' },
  pulsar: { kind: 'shake', amount: 8 },
  'static-fog': { kind: 'blur', amount: 5 },
};

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
   * Null: the calm CSS effects (PAGE_HITS). Otherwise every hit element is
   * attacked as the cursor is (puppets.ts), its displacement multiplied by
   * `fling` (by `frameFling` for a whole panel), and its size kept within `scale`.
   */
  puppets: {
    fling: number;
    frameFling: number;
    scale: readonly [number, number];
    /** The chance an element also gets a weird twist (puppets.ts `twistFor`). */
    weird: number;
    /** Wild twists (upside down, mirrored, squashed) instead of slight ones. */
    wild: boolean;
  } | null;
};

export const HIT_LEVELS: Readonly<Record<Intensity, HitLevel>> = {
  calm: {
    reach: {
      radius: CAT_CONFIG.pageHitRadius,
      max: CAT_CONFIG.maxPageTargets,
      anywhere: 0,
      frames: false,
    },
    puppets: null,
  },
  normal: {
    reach: { radius: 220, max: 8, anywhere: 4, frames: true },
    puppets: { fling: 1, frameFling: 0.5, scale: [0.25, 2], weird: 0.15, wild: false },
  },
  chaos: {
    reach: { radius: 400, max: 14, anywhere: 12, frames: true },
    puppets: { fling: 2.5, frameFling: 1.5, scale: [0.1, 4], weird: 0.6, wild: true },
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

/**
 * The same text with the letters of each word shuffled, spaces and punctuation in
 * place. A word that shuffles back to itself gets its first two letters swapped.
 */
export function scrambleText(text: string, random: Random): string {
  return text.replace(/[\p{L}\p{N}]{2,}/gu, (word) => {
    const letters = [...word];
    for (let i = letters.length - 1; i > 0; i--) {
      const j = random.int(0, i);
      [letters[i], letters[j]] = [letters[j], letters[i]];
    }
    const out = letters.join('');
    if (out !== word || new Set(word).size === 1) return out;
    return letters[1] + letters[0] + letters.slice(2).join('');
  });
}

/** True for an element whose only content is text: its text can be drawn over. */
function isTextLeaf(element: Element): boolean {
  if (element.children.length > 0) return false;
  if (element.matches('input, select, textarea, [contenteditable], [contenteditable] *')) {
    return false;
  }
  return (element.textContent ?? '').trim().length > 0;
}

/** A focused or editable field, or anything around one, never has its text touched. */
function mayTouchText(element: Element): boolean {
  const active = element.ownerDocument.activeElement;
  if (active && active !== element.ownerDocument.body && element.contains(active)) return false;
  return isTextLeaf(element);
}

const PROPERTIES = [
  '--xenocat-hit-amount',
  '--xenocat-hit-dx',
  '--xenocat-hit-dy',
  '--xenocat-hit-color',
] as const;

export const HIT_ATTRIBUTE = 'data-xenocat-hit';
export const TEXT_ATTRIBUTE = 'data-xenocat-hit-text';

/**
 * Applies `style` to `targets` for an attack by a cat centred at `cat`. Returns
 * the function that puts every target back exactly as it was.
 */
export function applyHits(
  targets: readonly HTMLElement[],
  style: HitStyle,
  cat: Vec,
  random: Random
): () => void {
  const saved = targets.map((element) => ({
    element,
    styleAttribute: element.getAttribute('style'),
    hit: element.getAttribute(HIT_ATTRIBUTE),
    text: element.getAttribute(TEXT_ATTRIBUTE),
  }));

  const set = (element: HTMLElement, name: (typeof PROPERTIES)[number], value: string) =>
    element.style.setProperty(name, value);
  // No inline style for text: the CSS hides the real text with a transparent text
  // fill and paints the shown text in the element's own colour.
  const textOver = (element: HTMLElement, text: string) => {
    element.setAttribute(TEXT_ATTRIBUTE, text);
    element.setAttribute(HIT_ATTRIBUTE, 'text');
  };

  if (style.kind === 'scramble') {
    for (const element of targets) {
      if (mayTouchText(element)) textOver(element, scrambleText(element.textContent!, random));
      else element.setAttribute(HIT_ATTRIBUTE, 'shake');
    }
  } else if (style.kind === 'swap') {
    // Pairs of text elements trade their text; anything left over shakes.
    const texts = targets.filter(mayTouchText);
    for (let i = 0; i + 1 < texts.length; i += 2) {
      const [a, b] = [texts[i], texts[i + 1]];
      const [textA, textB] = [a.textContent!, b.textContent!];
      textOver(a, textB);
      textOver(b, textA);
    }
    for (const element of targets) {
      if (!element.hasAttribute(TEXT_ATTRIBUTE)) element.setAttribute(HIT_ATTRIBUTE, 'shake');
    }
  } else {
    for (const element of targets) {
      if (style.amount !== undefined) set(element, '--xenocat-hit-amount', String(style.amount));
      if (style.color) set(element, '--xenocat-hit-color', style.color);
      if (style.kind === 'push') {
        const { x, y } = pushVector(element, style, cat);
        set(element, '--xenocat-hit-dx', `${x}px`);
        set(element, '--xenocat-hit-dy', `${y}px`);
      }
      element.setAttribute(HIT_ATTRIBUTE, style.kind);
    }
  }

  return () => {
    for (const { element, styleAttribute, hit, text } of saved) {
      // The very text it had, not a re-serialisation of it.
      if (styleAttribute === null) element.removeAttribute('style');
      else element.setAttribute('style', styleAttribute);
      if (hit === null) element.removeAttribute(HIT_ATTRIBUTE);
      else element.setAttribute(HIT_ATTRIBUTE, hit);
      if (text === null) element.removeAttribute(TEXT_ATTRIBUTE);
      else element.setAttribute(TEXT_ATTRIBUTE, text);
    }
  };
}

function pushVector(element: HTMLElement, style: HitStyle, cat: Vec): Vec {
  const amount = style.amount ?? 20;
  const rect = element.getBoundingClientRect();
  const centre = { x: (rect.left + rect.right) / 2, y: (rect.top + rect.bottom) / 2 };
  const dx = centre.x - cat.x;
  const dy = centre.y - cat.y;
  const length = Math.hypot(dx, dy) || 1;
  switch (style.direction) {
    case 'toward':
      return { x: (-dx / length) * amount, y: (-dy / length) * amount };
    case 'down':
      return { x: 0, y: amount };
    case 'up':
      return { x: 0, y: -amount };
    case 'sideways':
      return { x: Math.sign(dx || 1) * amount, y: 0 };
    default:
      return { x: (dx / length) * amount, y: (dy / length) * amount };
  }
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

/** Text effects (scrambled or swapped text) for the attacks that have one. */
export function hitText(
  targets: readonly HTMLElement[],
  effectId: string,
  random: Random
): (() => void) | null {
  const style = PAGE_HITS[effectId];
  if (!style || (style.kind !== 'scramble' && style.kind !== 'swap')) return null;
  return targets.length > 0 ? applyHits(targets, style, { x: 0, y: 0 }, random) : null;
}

/**
 * Hits the page around `pointer` with the calm CSS effects for an attack whose
 * effect is `effectId`, by a cat centred at `cat`. Returns the restore function,
 * or null if nothing was hit.
 */
export function hitPage(
  root: ParentNode,
  effectId: string,
  pointer: Vec,
  cat: Vec,
  random: Random,
  options: { radius?: number; max?: number } = {}
): (() => void) | null {
  const style = PAGE_HITS[effectId];
  if (!style) return null;
  const calm = HIT_LEVELS.calm.reach;
  const targets = pickTargets(
    root,
    pointer,
    { ...calm, radius: options.radius ?? calm.radius, max: options.max ?? calm.max },
    random
  );
  return targets.length > 0 ? applyHits(targets, style, cat, random) : null;
}
