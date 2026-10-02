// Page elements attacked the way the cursor is (page-hits.ts, above calm). Each hit
// element becomes a puppet for as long as the attack lasts, moving on its own, not
// with the mouse: it wanders along a path of its own (`wander`), as if an unseen
// hand held it, and the cat's effect acts on that as it does on the cursor and the
// mouse — Pinball bounces it about the screen, Spiral draws it in to the middle,
// Reverse runs its wandering backwards, Heavy drags it, Delay makes it lag, Vanish
// hides it, Giant grows it, and so on. Its displacement is multiplied by the
// intensity's `fling` (chaos throws things off the page), and some elements get a
// weird twist on top.
//
// It only writes the `translate`, `scale`, `rotate`, `opacity` and `filter` inline
// properties, and puts the `style` attribute back exactly as it was when the last
// attack on the element ends. An element hit by stacked attacks moves by all of
// them at once.

import { combineLooks } from './combos';
import { type CursorLook, type Effect, type Size, type Vec, restingLook } from './effects';
import type { HitLevel } from './page-hits';
import type { Random } from './random';

export type PuppetLevel = NonNullable<HitLevel['puppets']>;

/** A weird twist on an element: turned, and stretched or flipped. */
export type Twist = { rotate: number; scaleX: number; scaleY: number };

const NO_TWIST: Twist = { rotate: 0, scaleX: 1, scaleY: 1 };

/** Set on <html> while any element is a puppet: the page clips what flies off it. */
export const PUPPETS_ATTRIBUTE = 'data-xenocat-puppets';

/** How far an element wanders from where it was, px, before any effect. */
export const WANDER_PX = 60;

/** One axis of a wander: a sway of its own speed, starting where the element is. */
type Sway = { speed: number; phase: number };

/** Where a wander has taken an element `seconds` in, from where it was. */
export function wander(sways: readonly [Sway, Sway], seconds: number): Vec {
  const [x, y] = sways.map(
    ({ speed, phase }) => WANDER_PX * (Math.sin(speed * seconds + phase) - Math.sin(phase))
  );
  return { x, y };
}

/** Whether an element gets a twist, and which: slight, or (`wild`) anything goes. */
export function twistFor(random: Random, weird: number, wild: boolean): Twist {
  if (random.next() >= weird) return NO_TWIST;
  if (!wild) {
    const size = random.range(0.9, 1.1);
    return { rotate: random.range(-8, 8), scaleX: size, scaleY: size };
  }
  const side = random.next() < 0.5 ? -1 : 1;
  const twists: Twist[] = [
    { rotate: 180, scaleX: 1, scaleY: 1 }, // upside down
    { rotate: 0, scaleX: -1, scaleY: 1 }, // mirrored
    { rotate: 0, scaleX: 1.5, scaleY: 0.6 }, // squashed
    { rotate: 0, scaleX: 0.7, scaleY: 1.5 }, // stretched
    { rotate: side * random.range(25, 60), scaleX: 1, scaleY: 1 }, // leaning
    { rotate: side * random.range(5, 20), scaleX: 1.6, scaleY: 1.6 }, // huge
    { rotate: 0, scaleX: 0.5, scaleY: 0.5 }, // shrunk
  ];
  return random.pick(twists);
}

type Puppet = {
  effect: Effect;
  startedAt: number;
  /** The element's centre when the attack began. */
  home: Vec;
  /** Its own wandering path, and where that had taken it on the previous frame. */
  sways: [Sway, Sway];
  wandered: Vec;
  cat: Vec;
  roll: number;
  fling: number;
  state: unknown;
  look: CursorLook | null;
  lastFrameAt: number | null;
};

type Strings = { element: HTMLElement; style: string | null; twist: Twist; puppets: Puppet[] };

export type PuppetTheatre = ReturnType<typeof createPuppetTheatre>;

export function createPuppetTheatre(options: { random: Random }) {
  const { random } = options;
  const strings = new Map<HTMLElement, Strings>();
  let level: PuppetLevel | null = null;
  // Between 0.3 and 0.8 sways a second, at any point in the sway.
  const sway = (): Sway => ({
    speed: 2 * Math.PI * random.range(0.3, 0.8),
    phase: random.range(0, 2 * Math.PI),
  });

  const ended = (puppet: Puppet, now: number) => now - puppet.startedAt >= puppet.effect.durationMs;

  function release(entry: Strings) {
    // The very text it had, not a re-serialisation of it.
    if (entry.style === null) entry.element.removeAttribute('style');
    else entry.element.setAttribute('style', entry.style);
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
          entry = {
            element,
            style: element.getAttribute('style'),
            twist: twistFor(random, settings.weird, settings.wild),
            puppets: [],
          };
          strings.set(element, entry);
        }
        const rect = element.getBoundingClientRect();
        const frame = element.matches('[data-xenocat-frame]');
        entry.puppets.push({
          effect,
          startedAt: now,
          home: { x: (rect.left + rect.right) / 2, y: (rect.top + rect.bottom) / 2 },
          sways: [sway(), sway()],
          wandered: { x: 0, y: 0 },
          cat,
          // Each element its own roll: teleports and drifts go their own ways.
          roll: random.next(),
          fling: frame ? settings.frameFling : settings.fling,
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
        let dx = 0;
        let dy = 0;
        let look: CursorLook | null = null;
        for (const puppet of entry.puppets) {
          // Where its wandering alone would have taken it: the effect's "pointer".
          const elapsed = Math.max(now - puppet.startedAt, 0);
          const wandered = wander(puppet.sways, elapsed / 1000);
          const real = { x: puppet.home.x + wandered.x, y: puppet.home.y + wandered.y };
          const delta = { x: wandered.x - puppet.wandered.x, y: wandered.y - puppet.wandered.y };
          puppet.wandered = wandered;
          const result = puppet.effect.step({
            real,
            delta,
            previous: puppet.look ?? restingLook(real),
            start: puppet.home,
            cat: puppet.cat,
            elapsed,
            dt: puppet.lastFrameAt === null ? 0 : Math.max(now - puppet.lastFrameAt, 0),
            viewport,
            roll: puppet.roll,
            state: puppet.state,
          });
          puppet.state = result.state;
          puppet.look = result.look;
          puppet.lastFrameAt = now;
          dx += (result.look.x - puppet.home.x) * puppet.fling;
          dy += (result.look.y - puppet.home.y) * puppet.fling;
          look = look ? combineLooks(look, result.look) : result.look;
        }
        if (!look) continue;
        const { twist } = entry;
        const size = Math.min(Math.max(look.scale, smallest), biggest);
        const style = entry.element.style;
        style.translate = `${Math.round(dx)}px ${Math.round(dy)}px`;
        style.scale = `${twist.scaleX * size} ${twist.scaleY * size}`;
        style.rotate = `${twist.rotate}deg`;
        style.opacity = String(look.visible ? look.opacity : 0);
        style.filter =
          [
            look.blur > 0 ? `blur(${look.blur}px)` : '',
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
