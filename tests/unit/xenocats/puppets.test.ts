// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { CAT_TYPES } from '@/app/ui/xenocats/cat-types';
import { COMBOS } from '@/app/ui/xenocats/combos';
import {
  type Effect,
  ICE,
  JITTER_PX,
  DRUNK_AMPLITUDE,
  bounce,
  knockback,
} from '@/app/ui/xenocats/effects';
import { HIT_LEVELS } from '@/app/ui/xenocats/page-hits';
import { PUPPETS_ATTRIBUTE, createPuppetTheatre, span } from '@/app/ui/xenocats/puppets';
import { createRandom } from '@/app/ui/xenocats/random';

afterEach(() => {
  document.body.innerHTML = '';
});

const viewport = { width: 1200, height: 800 };
const cat = { x: 200, y: 200 };
const home = { x: 400, y: 300 };
const { calm, normal, chaos } = {
  calm: HIT_LEVELS.calm.puppets,
  normal: HIT_LEVELS.normal.puppets,
  chaos: HIT_LEVELS.chaos.puppets,
};

/** An element whose centre is at (x, y), 100 × 40 px unless told otherwise. */
function element(x: number, y: number, attributes = '', width = 100, height = 40) {
  document.body.insertAdjacentHTML('beforeend', `<button ${attributes}>Pay</button>`);
  const button = document.body.lastElementChild as HTMLElement;
  button.getBoundingClientRect = () =>
    ({
      left: x - width / 2,
      top: y - height / 2,
      right: x + width / 2,
      bottom: y + height / 2,
      width,
      height,
    }) as DOMRect;
  return button;
}

/** Where the element has been moved to, px. */
const moved = (el: HTMLElement) => {
  const [x, y] = el.style.translate.split(' ').map((v) => parseFloat(v) || 0);
  return { x, y: y ?? 0 };
};

type Frame = {
  at: number;
  d: { x: number; y: number };
  scale: number;
  opacity: string;
  filter: string;
};

/** One element under `effect`, frame by frame for as long as it lasts, then one frame after. */
function run(effect: Effect, settings = normal, at = home, attributes = '', seed = 5) {
  const theatre = createPuppetTheatre({ random: createRandom(seed) });
  const el = element(at.x, at.y, attributes);
  theatre.add([el], effect, cat, 0, settings);
  const frames: Frame[] = [];
  for (let now = 0; now < effect.durationMs; now += 16) {
    theatre.frame(now, viewport);
    frames.push({
      at: now,
      d: moved(el),
      scale: Number(el.style.scale),
      opacity: el.style.opacity,
      filter: el.style.filter,
    });
  }
  theatre.frame(effect.durationMs, viewport);
  return { frames, el, theatre };
}

const length = (v: { x: number; y: number }) => Math.hypot(v.x, v.y);
const centre = (f: Frame, from = home) => ({ x: from.x + f.d.x, y: from.y + f.d.y });
const toCat = (f: Frame) => length({ x: centre(f).x - cat.x, y: centre(f).y - cat.y });
const at = (frames: Frame[], ms: number) => frames.find((f) => f.at >= ms)!;
const last = (frames: Frame[]) => frames[frames.length - 1];

type Motion =
  | 'still'
  | 'shakes'
  | 'away'
  | 'drifts'
  | 'jumps'
  | 'toward'
  | 'circles'
  | 'sways'
  | 'falls'
  | 'spirals'
  | 'bounces'
  | 'away, then back';
type Look = 'plain' | 'hidden' | 'frost' | 'smoke' | 'shrinks' | 'grows' | 'pulses' | 'faint';

/**
 * What every attack does to a page element, as decisions.md's table says (D4): it
 * moves only if the attack moves a pointer held still, and looks as the cursor does.
 */
const TABLE: Record<string, { moves: Motion; looks: Look }> = {
  vanish: { moves: 'still', looks: 'hidden' },
  heavy: { moves: 'still', looks: 'plain' },
  knockback: { moves: 'away', looks: 'plain' },
  reverse: { moves: 'still', looks: 'plain' },
  jitter: { moves: 'shakes', looks: 'plain' },
  freeze: { moves: 'still', looks: 'frost' },
  drift: { moves: 'drifts', looks: 'plain' },
  teleport: { moves: 'jumps', looks: 'plain' },
  magnet: { moves: 'toward', looks: 'plain' },
  orbit: { moves: 'circles', looks: 'plain' },
  decoys: { moves: 'still', looks: 'plain' },
  drunk: { moves: 'sways', looks: 'plain' },
  tiny: { moves: 'still', looks: 'shrinks' },
  giant: { moves: 'still', looks: 'grows' },
  delay: { moves: 'still', looks: 'plain' },
  fall: { moves: 'falls', looks: 'plain' },
  blur: { moves: 'still', looks: 'smoke' },
  spiral: { moves: 'spirals', looks: 'plain' },
  bounce: { moves: 'bounces', looks: 'plain' },
  'axis-lock': { moves: 'still', looks: 'plain' },
  // The combos.
  'ice-puck': { moves: 'bounces', looks: 'frost' },
  slingshot: { moves: 'away, then back', looks: 'plain' },
  hangover: { moves: 'sways', looks: 'plain' },
  'ghost-jump': { moves: 'jumps', looks: 'faint' },
  pulsar: { moves: 'still', looks: 'pulses' },
  'static-fog': { moves: 'shakes', looks: 'smoke' },
};

const EFFECTS: Effect[] = [
  ...CAT_TYPES.map((type) => type.effect),
  ...COMBOS.map((combo) => combo.effect),
];

function expectMotion(moves: Motion, frames: Frame[]) {
  const distances = frames.map((f) => length(f.d));
  const furthest = Math.max(...distances);
  switch (moves) {
    case 'still':
      for (const f of frames) expect(f.d).toEqual({ x: 0, y: 0 });
      break;
    case 'shakes': {
      expect(furthest).toBeGreaterThan(0);
      expect(furthest).toBeLessThanOrEqual(JITTER_PX * Math.SQRT2 + 1);
      expect(new Set(frames.map((f) => `${f.d.x},${f.d.y}`)).size).toBeGreaterThan(10);
      break;
    }
    case 'away': {
      const end = last(frames).d;
      expect(length(end)).toBeGreaterThan(200);
      // Away from the cat: the same way as from the cat to the element.
      expect(end.x * (home.x - cat.x) + end.y * (home.y - cat.y)).toBeGreaterThan(0);
      break;
    }
    case 'drifts': {
      const [one, two] = [at(frames, 1000).d, at(frames, 2000).d];
      expect(length(two)).toBeGreaterThan(length(one) + 50);
      // One way all along.
      expect(Math.abs(Math.atan2(one.y, one.x) - Math.atan2(two.y, two.x))).toBeLessThan(0.05);
      break;
    }
    case 'jumps': {
      // A few spots, and nothing in between: it jumps, it does not slide.
      const spots = new Set(frames.map((f) => `${f.d.x},${f.d.y}`));
      expect(spots.size).toBeGreaterThan(1);
      expect(spots.size).toBeLessThanOrEqual(3);
      expect(furthest).toBeGreaterThan(50);
      break;
    }
    case 'toward':
      expect(toCat(last(frames))).toBeLessThan(toCat(frames[0]) / 2);
      break;
    case 'circles': {
      const rest = frames.slice(1);
      for (const f of rest) expect(Math.abs(toCat(f) - 140)).toBeLessThan(3);
      const angles = rest.map((f) => Math.atan2(centre(f).y - cat.y, centre(f).x - cat.x));
      expect(Math.max(...angles) - Math.min(...angles)).toBeGreaterThan(Math.PI);
      break;
    }
    case 'sways': {
      expect(furthest).toBeGreaterThan(10);
      expect(furthest).toBeLessThanOrEqual(DRUNK_AMPLITUDE * Math.SQRT2 + 1);
      expect(frames.some((f) => f.d.x > 5)).toBe(true);
      expect(frames.some((f) => f.d.x < -5)).toBe(true);
      break;
    }
    case 'falls': {
      for (const f of frames) expect(f.d.x).toBe(0);
      for (let i = 1; i < frames.length; i++) {
        expect(frames[i].d.y).toBeGreaterThanOrEqual(frames[i - 1].d.y);
      }
      expect(last(frames).d.y).toBeGreaterThan(200);
      break;
    }
    case 'spirals': {
      const end = centre(last(frames));
      expect(length({ x: end.x - 600, y: end.y - 400 })).toBeLessThan(60);
      break;
    }
    case 'bounces': {
      expect(furthest).toBeGreaterThan(200);
      // Off the edges and back: it turns round at least once on each axis... or one.
      const steps = frames.slice(1).map((f, i) => ({
        x: f.d.x - frames[i].d.x,
        y: f.d.y - frames[i].d.y,
      }));
      const turned = (axis: 'x' | 'y') =>
        steps.some((s) => s[axis] > 0) && steps.some((s) => s[axis] < 0);
      expect(turned('x') || turned('y')).toBe(true);
      break;
    }
    case 'away, then back': {
      const flung = toCat(at(frames, 1000));
      expect(flung).toBeGreaterThan(toCat(frames[0]) + 100);
      expect(toCat(last(frames))).toBeLessThan(toCat(frames[0]));
      break;
    }
  }
}

function expectLook(looks: Look, frames: Frame[]) {
  const mid = at(frames, 200);
  if (looks !== 'hidden' && looks !== 'smoke' && looks !== 'faint') {
    for (const f of frames) expect(f.opacity).toBe('1');
  }
  if (looks !== 'frost' && looks !== 'smoke') for (const f of frames) expect(f.filter).toBe('');
  if (!['shrinks', 'grows', 'pulses'].includes(looks)) {
    for (const f of frames) expect(f.scale).toBe(1);
  }
  switch (looks) {
    case 'hidden':
      for (const f of frames) expect(f.opacity).toBe('0');
      break;
    case 'frost':
      for (const f of frames) expect(f.filter).toContain(`drop-shadow(0 0 4px ${ICE})`);
      break;
    case 'smoke':
      for (const f of frames) {
        expect(f.filter).toMatch(/blur\(\d+(\.\d+)?px\) grayscale\(1\)/);
        expect(Number(f.opacity)).toBeLessThan(1);
      }
      break;
    case 'shrinks':
      expect(mid.scale).toBeLessThan(1);
      break;
    case 'grows':
      expect(mid.scale).toBeGreaterThan(1);
      break;
    case 'pulses':
      expect(frames.some((f) => f.scale < 1)).toBe(true);
      expect(frames.some((f) => f.scale > 1)).toBe(true);
      break;
    case 'faint':
      expect(Number(mid.opacity)).toBeGreaterThan(0);
      expect(Number(mid.opacity)).toBeLessThan(0.5);
      break;
  }
}

describe('every attack does to a page element what it does to the pointer', () => {
  it('the table covers every cat’s attack and every combo, and nothing else', () => {
    expect(Object.keys(TABLE).sort()).toEqual(EFFECTS.map((effect) => effect.id).sort());
  });

  for (const effect of EFFECTS) {
    const { moves, looks } = TABLE[effect.id] ?? {};
    it(`${effect.id}: moves ${moves}, looks ${looks}, and is put back exactly`, () => {
      const { frames, el } = run(effect, normal, home, 'style="color: red;"');
      expectMotion(moves, frames);
      expectLook(looks, frames);
      expect(el.getAttribute('style')).toBe('color: red;');
      expect(document.documentElement.hasAttribute(PUPPETS_ATTRIBUTE)).toBe(false);
    });
  }

  // An attack that puts the pointer somewhere (the middle, round the cat, off the
  // edges) puts an element there at every level, and a panel too: only how far an
  // attack *throws* it depends on the level.
  for (const effect of EFFECTS.filter((e) => e.amplify !== 'offset')) {
    const { moves } = TABLE[effect.id] ?? {};
    it(`${effect.id}: moves ${moves} when calm, in chaos, and as a panel`, () => {
      expectMotion(moves, run(effect, calm).frames);
      document.body.innerHTML = '';
      expectMotion(moves, run(effect, chaos).frames);
      document.body.innerHTML = '';
      expectMotion(moves, run(effect, normal, home, 'data-xenocat-frame').frames);
    });
  }

  it('the element never leaves the viewport, even flung by chaos', () => {
    for (const effect of EFFECTS) {
      for (const seed of [1, 2, 3]) {
        for (const f of run(effect, chaos, home, '', seed).frames) {
          const c = centre(f);
          expect(c.x - 50, effect.id).toBeGreaterThanOrEqual(0);
          expect(c.x + 50, effect.id).toBeLessThanOrEqual(viewport.width);
          expect(c.y - 20, effect.id).toBeGreaterThanOrEqual(0);
          expect(c.y + 20, effect.id).toBeLessThanOrEqual(viewport.height);
        }
        document.body.innerHTML = '';
      }
    }
  });

  it('one already partly off screen is never pulled further off, nor pulled in by an attack that does not move it', () => {
    const top = { x: 600, y: 5 };
    for (const f of run(knockback, chaos, { ...top }).frames) {
      expect(f.d.y).toBeGreaterThanOrEqual(0);
    }
    const frost = EFFECTS.find((effect) => effect.id === 'freeze')!;
    for (const f of run(frost, chaos, top).frames) expect(f.d).toEqual({ x: 0, y: 0 });
  });

  it('calm moves an element half as far as normal', () => {
    const tame = last(run(knockback, calm).frames).d;
    const full = last(run(knockback, normal).frames).d;
    expect(tame.x).toBeCloseTo(full.x * calm.fling, -1);
    expect(tame.y).toBeCloseTo(full.y * calm.fling, -1);
  });

  it('a panel goes less far than a button when normal', () => {
    const button = last(run(knockback, normal).frames).d;
    const panel = last(run(knockback, normal, home, 'data-xenocat-frame').frames).d;
    expect(panel.x).toBeCloseTo(button.x * normal.frameFling, -1);
  });
});

describe('the span an element may move in', () => {
  it('keeps its box inside the viewport, or no further out than it is', () => {
    expect(span(400, 100, 1200)).toEqual([50, 1150]);
    expect(span(10, 100, 1200)).toEqual([10, 1150]);
    // Bigger than the screen: it stays where it is.
    expect(span(600, 1500, 1200)).toEqual([600, 600]);
  });
});

describe('the theatre', () => {
  it('an element hit by two attacks moves by both', () => {
    const theatre = createPuppetTheatre({ random: createRandom(7) });
    const button = element(home.x, home.y);
    theatre.add([button], knockback, cat, 0, normal);
    theatre.frame(1000, viewport);
    const once = moved(button);
    theatre.add([button], knockback, cat, 1000, normal);
    theatre.frame(1400, viewport);
    expect(length(moved(button))).toBeGreaterThan(length(once) + 100);
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
