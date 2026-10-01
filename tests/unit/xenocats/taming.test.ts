import { describe, expect, it } from 'vitest';
import { CAT_TYPES, catTypeById } from '@/app/ui/xenocats/cat-types';
import { createRandom } from '@/app/ui/xenocats/random';
import {
  DODGES,
  TAMING_CONFIG,
  addTamed,
  createTaming,
  dodgeFor,
  dodgeTarget,
  parseCollection,
} from '@/app/ui/xenocats/taming';

const viewport = { width: 1200, height: 800 };
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

/** A game with one cat type only, its cat already on screen. */
function gameWith(typeId: string, pointer = { x: 100, y: 100 }, seed = 1) {
  const g = createTaming({
    random: createRandom(seed),
    types: [catTypeById(typeId)!],
    viewport,
    now: 0,
  });
  g.tick(0, pointer);
  g.tick(TAMING_CONFIG.breakMs, pointer);
  return g;
}

describe('dodging', () => {
  it('every cat type dodges in its own way', () => {
    const styles = CAT_TYPES.map((type) => JSON.stringify(dodgeFor(type)));
    expect(new Set(styles).size).toBe(CAT_TYPES.length);
    for (const type of CAT_TYPES) expect(DODGES[type.effect.id]).toBeDefined();
  });

  it('every dodge moves the cat, and stays on screen', () => {
    const cat = { x: 600, y: 400 };
    const pointer = { x: 560, y: 380 };
    for (const type of CAT_TYPES) {
      const to = dodgeTarget(dodgeFor(type), cat, pointer, viewport, createRandom(2));
      expect(distance(to, cat), type.id).toBeGreaterThan(10);
      expect(to.x).toBeGreaterThanOrEqual(0);
      expect(to.x).toBeLessThanOrEqual(viewport.width);
      expect(to.y).toBeGreaterThanOrEqual(0);
      expect(to.y).toBeLessThanOrEqual(viewport.height);
    }
  });

  it('dashing, blinking, dropping and axis cats end up further from the pointer', () => {
    const cat = { x: 600, y: 400 };
    const pointer = { x: 540, y: 380 };
    for (const type of CAT_TYPES) {
      const style = dodgeFor(type);
      if (!['dash', 'blink', 'drop', 'axis', 'mirror'].includes(style.kind)) continue;
      const to = dodgeTarget(style, cat, pointer, viewport, createRandom(3));
      expect(distance(to, pointer), type.id).toBeGreaterThanOrEqual(distance(cat, pointer) - 1e-9);
    }
  });

  it('kinds behave as named', () => {
    const cat = { x: 600, y: 400 };
    const pointer = { x: 500, y: 400 };
    const r = () => createRandom(4);
    const of = (id: string) => dodgeFor(catTypeById(id)!);
    // Laser Ocicat: along one axis only.
    expect(dodgeTarget(of('laser-ocicat'), cat, pointer, viewport, r()).y).toBe(400);
    // Gravity Manx: straight down.
    expect(dodgeTarget(of('gravity-manx'), cat, pointer, viewport, r()).x).toBe(600);
    // Mirror Sphynx: through the pointer to the other side.
    expect(dodgeTarget(of('mirror-sphynx'), cat, pointer, viewport, r())).toEqual({
      x: 400,
      y: 400,
    });
    // Quantum Kitten: reappears at least its distance from the pointer.
    expect(
      distance(dodgeTarget(of('quantum-kitten'), cat, pointer, viewport, r()), pointer)
    ).toBeGreaterThanOrEqual(400);
  });

  it('a pointer moving close makes the cat dodge away', () => {
    const g = gameWith('pulsar-siamese'); // knockback: dashes 320 px
    const cat = g.snapshot(TAMING_CONFIG.breakMs).cat!;
    const near = { x: cat.x - 60, y: cat.y };
    let now = TAMING_CONFIG.breakMs + 16;
    g.tick(now, near);
    for (now += 16; now < TAMING_CONFIG.breakMs + 600; now += 16) g.tick(now, near);
    const after = g.snapshot(now).cat!;
    expect(distance(after, near)).toBeGreaterThan(distance(cat, near) + 100);
  });

  it('the lagging cat notices late', () => {
    const g = gameWith('lag-ragamuffin'); // delay: reacts after 800 ms
    const cat = g.snapshot(TAMING_CONFIG.breakMs).cat!;
    const near = { x: cat.x - 60, y: cat.y };
    let now = TAMING_CONFIG.breakMs + 16;
    g.tick(now, near);
    for (now += 16; now < TAMING_CONFIG.breakMs + 700; now += 16) g.tick(now, near);
    expect(g.snapshot(now).cat).toMatchObject({ x: cat.x, y: cat.y });
    for (; now < TAMING_CONFIG.breakMs + 1600; now += 16) g.tick(now, near);
    expect(distance(g.snapshot(now).cat!, cat)).toBeGreaterThan(50);
  });
});

describe('taming: hold still on the cat for 2 s', () => {
  /** Keeps the pointer still at `at` from `from` to `to`; returns any cat tamed. */
  function hold(
    g: ReturnType<typeof gameWith>,
    at: { x: number; y: number },
    from: number,
    to: number
  ) {
    let tamed: string | null = null;
    for (let now = from; now <= to; now += 16) tamed = g.tick(now, at) ?? tamed;
    return tamed;
  }

  it('a still pointer draws the cat over, and two seconds on it tames the cat', () => {
    const pointer = { x: 100, y: 100 };
    const g = gameWith('void-tabby', pointer);
    const start = TAMING_CONFIG.breakMs;
    // Curious after 1 s, then it walks over (at most ~1300 px at 110 px/s), then 2 s.
    const tamed = hold(g, pointer, start + 16, start + 20_000);
    expect(tamed).toBe('void-tabby');
    const snap = g.snapshot(start + 20_000);
    expect(snap.tamed).toContain('void-tabby');
  });

  it('is tamed two seconds after the hold begins, not before', () => {
    // Wait for the cat to come to a still pointer, and time the hold from there.
    const pointer = { x: 100, y: 100 };
    const g = gameWith('void-tabby', pointer);
    const start = TAMING_CONFIG.breakMs;
    let now = start + 16;
    for (; now < start + 20_000; now += 16) {
      g.tick(now, pointer);
      if (g.snapshot(now).cat?.doing === 'held') break;
    }
    expect(g.snapshot(now).cat?.doing).toBe('held');
    const heldAt = now;
    let tamedAt: number | null = null;
    for (now += 16; now < heldAt + 3000; now += 16) {
      if (g.tick(now, pointer)) {
        tamedAt = now;
        break;
      }
    }
    expect(tamedAt).not.toBeNull();
    expect(tamedAt! - heldAt).toBeGreaterThanOrEqual(TAMING_CONFIG.tameMs);
    expect(tamedAt! - heldAt).toBeLessThan(TAMING_CONFIG.tameMs + 50);
  });

  it('moving during the hold starts it over (and the cat dodges)', () => {
    const pointer = { x: 100, y: 100 };
    const g = gameWith('void-tabby', pointer);
    let now = TAMING_CONFIG.breakMs + 16;
    for (; now < 30_000; now += 16) {
      g.tick(now, pointer);
      if (g.snapshot(now).cat?.doing === 'held') break;
    }
    for (const end = now + 1500; now < end; now += 16) g.tick(now, pointer);
    expect(g.snapshot(now).hold).toBeGreaterThan(0.6);
    // A twitch of 10 px: no longer still.
    expect(g.tick(now + 16, { x: 110, y: 100 })).toBeNull();
    expect(g.snapshot(now + 16).hold).toBe(0);
    expect(g.snapshot(now + 16).tamed).toEqual([]);
  });

  it('a pointer resting next to the cat, not on it, does not tame it', () => {
    const start = TAMING_CONFIG.breakMs;
    // A cat that never walks, so the pointer stays just off it.
    const shy = createTaming({
      random: createRandom(1),
      types: [catTypeById('void-tabby')!],
      viewport,
      now: 0,
      config: { curiousAfterMs: Infinity, walkSpeed: 0 },
    });
    shy.tick(0, { x: 0, y: 0 });
    shy.tick(start, { x: 0, y: 0 });
    const shyCat = shy.snapshot(start).cat!;
    const beside = { x: shyCat.x + TAMING_CONFIG.catchRadius + 5, y: shyCat.y };
    // The pointer lands just off the cat (which dodges), then keeps still; with no
    // walking, the cat never comes back under it.
    let tamed: string | null = null;
    for (let now = start + 16; now < start + 5000; now += 16) {
      tamed = shy.tick(now, beside) ?? tamed;
    }
    expect(tamed).toBeNull();
    expect(shy.snapshot(start + 5000).hold).toBe(0);
  });

  it('after a cat is tamed, the next one comes', () => {
    const pointer = { x: 100, y: 100 };
    const g = gameWith('void-tabby', pointer);
    let now = TAMING_CONFIG.breakMs + 16;
    for (; now < 30_000; now += 16) if (g.tick(now, pointer)) break;
    expect(g.snapshot(now).cat).toBeNull();
    for (const end = now + TAMING_CONFIG.breakMs + 32; now < end; now += 16) g.tick(now, pointer);
    expect(g.snapshot(now).cat).not.toBeNull();
  });
});

describe('never more than five cats', () => {
  it('no cat comes while the screen is full of other cats', () => {
    const g = createTaming({ random: createRandom(1), types: CAT_TYPES, viewport, now: 0 });
    for (let now = 0; now < 10_000; now += 16) g.tick(now, { x: 100, y: 100 }, 0);
    expect(g.snapshot(10_000).cat).toBeNull();
    g.tick(10_016, { x: 100, y: 100 }, 1);
    expect(g.snapshot(10_016).cat).not.toBeNull();
  });
});

describe('the tamed collection', () => {
  it('counts tamed cats by type', () => {
    expect(addTamed(addTamed({}, 'void-tabby'), 'void-tabby')).toEqual({ 'void-tabby': 2 });
    expect(addTamed({ 'void-tabby': 1 }, 'gravi-coon')).toEqual({
      'void-tabby': 1,
      'gravi-coon': 1,
    });
  });

  it('reads back what was stored, dropping anything malformed or unknown', () => {
    expect(parseCollection(null, CAT_TYPES)).toEqual({});
    expect(parseCollection('not json', CAT_TYPES)).toEqual({});
    expect(parseCollection('[1,2]', CAT_TYPES)).toEqual({});
    expect(
      parseCollection(
        JSON.stringify({
          'void-tabby': 3,
          'no-such-cat': 1,
          'gravi-coon': -1,
          'cryo-persian': 1.5,
        }),
        CAT_TYPES
      )
    ).toEqual({ 'void-tabby': 3 });
  });
});
