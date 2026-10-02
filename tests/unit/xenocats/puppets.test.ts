// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  type Effect,
  bounce,
  giant,
  heavy,
  restingLook,
  reverse,
  spiral,
  vanish,
} from '@/app/ui/xenocats/effects';
import { HIT_LEVELS } from '@/app/ui/xenocats/page-hits';
import {
  PUPPETS_ATTRIBUTE,
  WANDER_PX,
  createPuppetTheatre,
  twistFor,
} from '@/app/ui/xenocats/puppets';
import { createRandom } from '@/app/ui/xenocats/random';

afterEach(() => {
  document.body.innerHTML = '';
});

const viewport = { width: 1200, height: 800 };
const cat = { x: 100, y: 100 };
const normal = { ...HIT_LEVELS.normal.puppets!, weird: 0 };
const chaos = { ...HIT_LEVELS.chaos.puppets!, weird: 0 };

/** An element whose centre is at (x, y), 100 × 40 px. */
function element(x: number, y: number, attributes = '') {
  document.body.insertAdjacentHTML('beforeend', `<button ${attributes}>Pay</button>`);
  const button = document.body.lastElementChild as HTMLElement;
  button.getBoundingClientRect = () =>
    ({
      left: x - 50,
      top: y - 20,
      right: x + 50,
      bottom: y + 20,
      width: 100,
      height: 40,
    }) as DOMRect;
  return button;
}

/** Where the element has been moved to, px. */
const moved = (el: HTMLElement) => {
  const [x, y] = el.style.translate.split(' ').map((v) => parseFloat(v) || 0);
  return { x, y: y ?? 0 };
};

/** Lets the "pointer" through as it is: what the element does is its own wandering alone. */
const follow: Effect = {
  id: 'follow',
  name: 'Follow',
  description: 'test only',
  durationMs: 3000,
  step: ({ real }) => ({ look: restingLook(real) }),
};

/**
 * One element under `effect` (and the same element under `follow`, wandering the
 * same way: the same seed gives the same path), run to `until` ms.
 */
function compare(effect: Effect, until: number, settings = normal) {
  const run = (e: Effect) => {
    const theatre = createPuppetTheatre({ random: createRandom(7) });
    const button = element(600, 400);
    theatre.add([button], e, cat, 0, settings);
    for (let now = 0; now <= until; now += 16) theatre.frame(now, viewport);
    return moved(button);
  };
  return { under: run(effect), alone: run(follow) };
}

describe('page elements attacked as the cursor is', () => {
  it('move on their own, the mouse nowhere involved, each on a path of its own', () => {
    const theatre = createPuppetTheatre({ random: createRandom(1) });
    const a = element(300, 300);
    const b = element(900, 500);
    theatre.add([a, b], follow, cat, 0, normal);
    const seen = new Set<string>();
    for (let now = 0; now <= 2000; now += 100) {
      theatre.frame(now, viewport);
      seen.add(a.style.translate);
      expect(Math.hypot(moved(a).x, moved(a).y)).toBeLessThanOrEqual(2 * WANDER_PX * Math.SQRT2);
    }
    expect(seen.size).toBeGreaterThan(10);
    expect(moved(a)).not.toEqual(moved(b));
  });

  it('reverse runs an element’s wandering backwards; heavy drags it', () => {
    const backwards = compare(reverse, 1500);
    expect(backwards.under.x).toBeCloseTo(-backwards.alone.x, 0);
    expect(backwards.under.y).toBeCloseTo(-backwards.alone.y, 0);
    const dragged = compare(heavy, 1500);
    expect(Math.hypot(dragged.under.x, dragged.under.y)).toBeLessThan(
      Math.hypot(dragged.alone.x, dragged.alone.y)
    );
  });

  it('pinball bounces them about the screen, each its own way', () => {
    const theatre = createPuppetTheatre({ random: createRandom(3) });
    const a = element(300, 300);
    const b = element(900, 500);
    theatre.add([a, b], bounce, cat, 0, normal);
    let furthest = 0;
    for (let now = 0; now <= 2000; now += 16) {
      theatre.frame(now, viewport);
      furthest = Math.max(furthest, Math.hypot(moved(a).x, moved(a).y));
    }
    expect(furthest).toBeGreaterThan(200);
    expect(moved(a)).not.toEqual(moved(b));
  });

  it('spiral draws them in to the middle of the screen', () => {
    const theatre = createPuppetTheatre({ random: createRandom(1) });
    const button = element(200, 200);
    theatre.add([button], spiral, cat, 0, normal);
    for (let now = 0; now < spiral.durationMs; now += 16) theatre.frame(now, viewport);
    const at = { x: 200 + moved(button).x, y: 200 + moved(button).y };
    expect(Math.hypot(at.x - 600, at.y - 400)).toBeLessThan(60);
  });

  it('vanish hides them; giant grows them, within the level’s limit', () => {
    const theatre = createPuppetTheatre({ random: createRandom(1) });
    const hidden = element(300, 300);
    const big = element(800, 300);
    theatre.add([hidden], vanish, cat, 0, normal);
    theatre.add([big], giant, cat, 0, normal);
    theatre.frame(100, viewport);
    expect(hidden.style.opacity).toBe('0');
    expect(big.style.scale).toBe(`${normal.scale[1]} ${normal.scale[1]}`);
  });

  it('chaos flings them further; a panel goes less far when normal', () => {
    const wild = compare(follow, 1500, chaos);
    const tame = compare(follow, 1500, normal);
    expect(wild.under.x).toBeCloseTo(tame.under.x * chaos.fling, 0);
    const theatre = createPuppetTheatre({ random: createRandom(7) });
    const panel = element(600, 400, 'data-xenocat-frame');
    theatre.add([panel], follow, cat, 0, normal);
    for (let now = 0; now <= 1500; now += 16) theatre.frame(now, viewport);
    expect(moved(panel).x).toBeCloseTo(tame.under.x * normal.frameFling, 0);
  });

  it('an element hit by two attacks moves by both', () => {
    const one = compare(follow, 1000);
    const theatre = createPuppetTheatre({ random: createRandom(7) });
    const button = element(600, 400);
    theatre.add([button], follow, cat, 0, normal);
    theatre.add([button], follow, cat, 0, normal);
    for (let now = 0; now <= 1000; now += 16) theatre.frame(now, viewport);
    // Two wanderings at once: further than either alone would go, in all.
    expect(moved(button)).not.toEqual(one.under);
    expect(button.style.translate).not.toBe('');
  });

  it('puts the style back exactly when the attack ends, and marks the page while it lasts', () => {
    const theatre = createPuppetTheatre({ random: createRandom(1) });
    const styled = element(500, 300, 'style="color: red;"');
    const plain = element(800, 300);
    theatre.add([styled, plain], bounce, cat, 0, normal);
    theatre.frame(100, viewport);
    expect(document.documentElement.hasAttribute(PUPPETS_ATTRIBUTE)).toBe(true);
    expect(theatre.isActive(100)).toBe(true);
    expect(theatre.isActive(bounce.durationMs)).toBe(false);
    theatre.frame(bounce.durationMs, viewport);
    expect(styled.getAttribute('style')).toBe('color: red;');
    expect(plain.hasAttribute('style')).toBe(false);
    expect(document.documentElement.hasAttribute(PUPPETS_ATTRIBUTE)).toBe(false);
  });

  it('clear puts everything back at once', () => {
    const theatre = createPuppetTheatre({ random: createRandom(1) });
    const button = element(500, 300);
    theatre.add([button], bounce, cat, 0, chaos);
    theatre.frame(100, viewport);
    theatre.clear();
    expect(button.hasAttribute('style')).toBe(false);
    expect(document.documentElement.hasAttribute(PUPPETS_ATTRIBUTE)).toBe(false);
  });
});

describe('weird twists', () => {
  it('never at 0, always at 1; slight when normal, wild in chaos', () => {
    const random = createRandom(4);
    for (let i = 0; i < 50; i++) {
      expect(twistFor(random, 0, true)).toEqual({ rotate: 0, scaleX: 1, scaleY: 1 });
      const slight = twistFor(random, 1, false);
      expect(Math.abs(slight.rotate)).toBeLessThanOrEqual(8);
      expect(slight.scaleX).toBeGreaterThanOrEqual(0.9);
    }
    const wild = Array.from({ length: 60 }, () => twistFor(random, 1, true));
    expect(wild.some((t) => t.rotate === 180)).toBe(true);
    expect(wild.some((t) => t.scaleX < 0)).toBe(true);
  });
});
