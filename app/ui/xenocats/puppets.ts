// Page elements attacked the way the cursor is (page-hits.ts). Each hit element
// becomes a puppet for as long as the attack lasts, and does what the attack does
// to a pointer held still where the element stands, and nothing else: it moves
// only if the attack moves that pointer. Pinball flings it off to bounce about the
// screen, Spiral draws it in to the middle, Knockback throws it away from the cat,
// Static shakes it; Freeze frosts it, Vanish hides it, Smoke hides it behind a
// smoke screen, Tiny and Giant shrink and grow it, all where it stands; and an
// attack that only changes how the pointer follows the mouse (Heavy, Reverse,
// Delay, Axis lock, Decoys) leaves a still element as it is. The level's `fling`
// scales how far an attack that throws the pointer some way (Knockback, Drift,
// Static, Teleport, Fall …) throws the element (calm: half as far as the cursor);
// one that puts the pointer somewhere (Spiral, Orbit, Magnet, Pinball) puts the
// element there at every level. It stays on screen, as the cursor does: its box never leaves the viewport, or,
// for one that was partly off it already, goes no further off than it was.
//
// It only writes the `translate`, `scale`, `opacity` and `filter` inline
// properties, and puts the `style` attribute back exactly as it was when the last
// attack on the element ends. An element hit by stacked attacks moves by all of
// them at once.

import { combineLooks } from './combos';
import { type CursorLook, type Effect, type Size, type Vec, restingLook } from './effects';
import type { HitLevel } from './page-hits';
import type { Random } from './random';

export type PuppetLevel = HitLevel['puppets'];

/** Set on <html> while any element is a puppet: the page clips what flies off it. */
export const PUPPETS_ATTRIBUTE = 'data-xenocat-puppets';

/** An element's blur is the cursor's times this: enough to hide it, as smoke would. */
export const SMOKE_BLUR_SCALE = 3;

/**
 * Where an element's centre may go on one axis: anywhere that keeps the element
 * inside the viewport, widened to take in where it is now (so one already partly
 * off screen, or bigger than the screen, is never pulled in either).
 */
export function span(centre: number, size: number, viewport: number): [number, number] {
  return [Math.min(size / 2, centre), Math.max(viewport - size / 2, centre)];
}

type Puppet = {
  effect: Effect;
  startedAt: number;
  cat: Vec;
  roll: number;
  fling: number;
  state: unknown;
  look: CursorLook | null;
  lastFrameAt: number | null;
};

type Strings = {
  element: HTMLElement;
  style: string | null;
  /** Its centre and size when the first attack on it began, before anything moved it. */
  home: Vec;
  size: Size;
  puppets: Puppet[];
};

export type PuppetTheatre = ReturnType<typeof createPuppetTheatre>;

export function createPuppetTheatre(options: { random: Random }) {
  const { random } = options;
  const strings = new Map<HTMLElement, Strings>();
  let level: PuppetLevel | null = null;

  const ended = (puppet: Puppet, now: number) => now - puppet.startedAt >= puppet.effect.durationMs;

  function release(entry: Strings) {
    // The very text it had, not a re-serialisation of it. Set before it is removed:
    // Chromium writes CSSOM changes to the attribute lazily, and removing it alone
    // left a pending write to land afterwards, as an empty style="".
    entry.element.setAttribute('style', entry.style ?? '');
    if (entry.style === null) entry.element.removeAttribute('style');
    strings.delete(entry.element);
  }

  function markPage() {
    const root = typeof document === 'undefined' ? null : document.documentElement;
    if (!root) return;
    if (strings.size > 0) root.setAttribute(PUPPETS_ATTRIBUTE, '');
    else root.removeAttribute(PUPPETS_ATTRIBUTE);
  }

  return {
    /** Makes `targets` puppets under `effect` from a cat at `cat`, for as long as it lasts. */
    add(
      targets: readonly HTMLElement[],
      effect: Effect,
      cat: Vec,
      now: number,
      settings: PuppetLevel
    ) {
      level = settings;
      for (const element of targets) {
        let entry = strings.get(element);
        if (!entry) {
          const rect = element.getBoundingClientRect();
          entry = {
            element,
            style: element.getAttribute('style'),
            home: { x: (rect.left + rect.right) / 2, y: (rect.top + rect.bottom) / 2 },
            size: { width: rect.right - rect.left, height: rect.bottom - rect.top },
            puppets: [],
          };
          strings.set(element, entry);
        }
        const frame = element.matches('[data-xenocat-frame]');
        entry.puppets.push({
          effect,
          startedAt: now,
          cat,
          // Each element its own roll: teleports and drifts go their own ways.
          roll: random.next(),
          // Only an attack that throws the pointer some way from where it is goes
          // further or less far; one that puts it somewhere (the middle, round the
          // cat, bouncing off the edges) puts the element there at every level, as
          // `strengthen` does for an angry cat (effects.ts).
          fling: effect.amplify !== 'offset' ? 1 : frame ? settings.frameFling : settings.fling,
          state: undefined,
          look: null,
          lastFrameAt: null,
        });
      }
      markPage();
    },

    /** True while any element is still a puppet. */
    isActive(now: number): boolean {
      for (const entry of strings.values()) {
        if (entry.puppets.some((puppet) => !ended(puppet, now))) return true;
      }
      return false;
    },

    /** Moves every puppet one frame on; frees the ones whose attack is over. */
    frame(now: number, viewport: Size) {
      const [smallest, biggest] = level?.scale ?? [0.25, 2];

      for (const entry of [...strings.values()]) {
        entry.puppets = entry.puppets.filter((puppet) => !ended(puppet, now));
        if (entry.puppets.length === 0) {
          release(entry);
          continue;
        }
        const { home, size } = entry;
        // The effect runs as it does on the cursor, in a "screen" that is the span
        // the element's centre may cover: its edges are where the element's box
        // meets the viewport's, so a pinball bounces it off them.
        const [left, right] = span(home.x, size.width, viewport.width);
        const [top, bottom] = span(home.y, size.height, viewport.height);
        const area = { width: right - left + 1, height: bottom - top + 1 };
        const into = (point: Vec): Vec => ({ x: point.x - left, y: point.y - top });
        const still = into(home);
        let dx = 0;
        let dy = 0;
        let look: CursorLook | null = null;
        for (const puppet of entry.puppets) {
          const elapsed = Math.max(now - puppet.startedAt, 0);
          // A pointer held still where the element stands.
          const result = puppet.effect.step({
            real: still,
            delta: { x: 0, y: 0 },
            previous: puppet.look ?? restingLook(still),
            start: still,
            cat: into(puppet.cat),
            elapsed,
            dt: puppet.lastFrameAt === null ? 0 : Math.max(now - puppet.lastFrameAt, 0),
            viewport: area,
            roll: puppet.roll,
            state: puppet.state,
          });
          puppet.state = result.state;
          puppet.look = result.look;
          puppet.lastFrameAt = now;
          dx += (result.look.x - still.x) * puppet.fling;
          dy += (result.look.y - still.y) * puppet.fling;
          look = look ? combineLooks(look, result.look) : result.look;
        }
        if (!look) continue;
        dx = Math.min(Math.max(home.x + dx, left), right) - home.x;
        dy = Math.min(Math.max(home.y + dy, top), bottom) - home.y;
        const scale = Math.min(Math.max(look.scale, smallest), biggest);
        const style = entry.element.style;
        style.translate = `${Math.round(dx)}px ${Math.round(dy)}px`;
        style.scale = String(scale);
        style.opacity = String(look.visible ? look.opacity : 0);
        style.filter =
          [
            look.blur > 0 ? `blur(${look.blur * SMOKE_BLUR_SCALE}px) grayscale(1)` : '',
            look.tint ? `drop-shadow(0 0 4px ${look.tint}) drop-shadow(0 0 10px ${look.tint})` : '',
          ]
            .filter(Boolean)
            .join(' ') || '';
      }
      markPage();
    },

    /** Frees every puppet at once (the page is going away). */
    clear() {
      for (const entry of [...strings.values()]) release(entry);
      markPage();
    },
  };
}
