import { describe, expect, it } from 'vitest';
import { CAT_TYPES, catTypeById } from '@/app/ui/xenocats/cat-types';
import { PAD_SIZE, padDirection } from '@/app/ui/xenocats/movement-pad';
import { createRandom } from '@/app/ui/xenocats/random';
import {
  DODGES,
  TAMING_CONFIG,
  TREATS,
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
    const cat = g.snapshot().cat!;
    // On the cat's side nearer the edge: it runs off into open screen, not a wall.
    const near = { x: cat.x + 60 * Math.sign(cat.x - 600 || 1), y: cat.y };
    let now = TAMING_CONFIG.breakMs + 16;
    g.tick(now, near);
    for (now += 16; now < TAMING_CONFIG.breakMs + 600; now += 16) g.tick(now, near);
    const after = g.snapshot().cat!;
    expect(distance(after, near)).toBeGreaterThan(distance(cat, near) + 100);
  });

  it('the lagging cat notices late', () => {
    const g = gameWith('lag-ragamuffin'); // delay: reacts after 800 ms
    const cat = g.snapshot().cat!;
    // On the cat's side nearer the edge: it runs off into open screen, not a wall.
    const near = { x: cat.x + 60 * Math.sign(cat.x - 600 || 1), y: cat.y };
    let now = TAMING_CONFIG.breakMs + 16;
    g.tick(now, near);
    for (now += 16; now < TAMING_CONFIG.breakMs + 700; now += 16) g.tick(now, near);
    expect(g.snapshot().cat).toMatchObject({ x: cat.x, y: cat.y });
    for (; now < TAMING_CONFIG.breakMs + 1600; now += 16) g.tick(now, near);
    expect(distance(g.snapshot().cat!, cat)).toBeGreaterThan(50);
  });
});

/** A game with one cat type, its treats and cat on their own clock; the ranger far off. */
function treatGame(config: Partial<typeof TAMING_CONFIG> = {}, typeId = 'void-tabby', seed = 1) {
  return createTaming({
    random: createRandom(seed),
    types: [catTypeById(typeId)!],
    viewport,
    now: 0,
    config,
  });
}

/** Runs from `from` to `to` (16 ms frames), the ranger where `at` says; returns every event. */
function run(
  g: ReturnType<typeof treatGame>,
  from: number,
  to: number,
  at: (now: number) => { x: number; y: number }
) {
  const events = { tamed: [] as string[], attacks: [] as number[], picked: [] as string[] };
  for (let now = from; now <= to; now += 16) {
    const e = g.tick(now, at(now));
    if (e.tamed) events.tamed.push(e.tamed);
    if (e.attack) events.attacks.push(now);
    if (e.picked) events.picked.push(e.picked);
  }
  return events;
}

const corner = { x: 5, y: 5 };

describe('treats', () => {
  it('turn up at random spots, a few at a time, as often as the config says', () => {
    const g = treatGame({ treatEveryMs: 1000, maxTreats: 3, treatLifeMs: 60_000 });
    run(g, 0, 500, () => corner);
    expect(g.snapshot().treats).toHaveLength(1);
    run(g, 516, 2100, () => corner);
    expect(g.snapshot().treats).toHaveLength(3);
    // Never more than the most at once.
    run(g, 2116, 10_000, () => corner);
    const { treats } = g.snapshot();
    expect(treats).toHaveLength(3);
    expect(new Set(treats.map((t) => `${t.x},${t.y}`)).size).toBe(3);
    for (const treat of treats) {
      expect(TREATS.map((t) => t.kind)).toContain(treat.kind);
      expect(treat.x).toBeGreaterThan(0);
      expect(treat.x).toBeLessThan(viewport.width);
    }
  });

  it('vanish when nobody picks them up', () => {
    const g = treatGame({ treatEveryMs: 100_000, treatLifeMs: 2000 });
    run(g, 0, 1984, () => corner);
    expect(g.snapshot().treats).toHaveLength(1);
    run(g, 2000, 2016, () => corner);
    expect(g.snapshot().treats).toHaveLength(0);
  });

  it('walking over one picks it up; one at a time', () => {
    const g = treatGame({ treatEveryMs: 100, maxTreats: 2, treatLifeMs: 60_000 });
    run(g, 0, 200, () => corner);
    const [first, second] = g.snapshot().treats;
    expect(second).toBeDefined();
    const e = g.tick(216, first);
    expect(e.picked).toBe(first.kind);
    expect(g.snapshot().carrying).toBe(first.kind);
    expect(g.snapshot().treats.map((t) => t.id)).not.toContain(first.id);
    // Already carrying one: walking over another leaves it where it is.
    expect(g.tick(232, second).picked).toBeNull();
    expect(g.snapshot().carrying).toBe(first.kind);
    expect(g.snapshot().treats.map((t) => t.id)).toContain(second.id);
  });
});

describe('the cat, without a treat', () => {
  it('attacks the ranger from a distance, as often as the config says, and not from afar', () => {
    const g = treatGame({ treatEveryMs: 1e9, walkSpeed: 0, attackEveryMs: 1000 });
    run(g, 0, TAMING_CONFIG.breakMs, () => corner);
    const cat = g.snapshot().cat!;
    // Inside the attack range but outside the flee radius: it stays and attacks.
    const near = { x: cat.x + 250 * Math.sign(600 - cat.x || 1), y: cat.y };
    const events = run(g, TAMING_CONFIG.breakMs + 16, TAMING_CONFIG.breakMs + 4000, () => near);
    expect(events.attacks.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < events.attacks.length; i++) {
      expect(events.attacks[i] - events.attacks[i - 1]).toBeGreaterThanOrEqual(1000);
    }
    // Far off: no attacks.
    const far = run(g, TAMING_CONFIG.breakMs + 4016, TAMING_CONFIG.breakMs + 8000, () => ({
      x: cat.x > 600 ? 0 : viewport.width,
      y: cat.y > 400 ? 0 : viewport.height,
    }));
    expect(far.attacks).toEqual([]);
  });

  it('flees a ranger who comes close', () => {
    const g = treatGame({ treatEveryMs: 1e9 }, 'pulsar-siamese'); // knockback: dashes 320 px
    run(g, 0, TAMING_CONFIG.breakMs, () => corner);
    const cat = g.snapshot().cat!;
    // On the cat's side nearer the edge: it runs off into open screen, not a wall.
    const near = { x: cat.x + 60 * Math.sign(cat.x - 600 || 1), y: cat.y };
    run(g, TAMING_CONFIG.breakMs + 16, TAMING_CONFIG.breakMs + 600, () => near);
    expect(distance(g.snapshot().cat!, near)).toBeGreaterThan(distance(cat, near) + 100);
    expect(g.snapshot().tamed).toEqual([]);
  });

  it('is never tamed by touching it empty-handed', () => {
    const g = treatGame({ treatEveryMs: 1e9 });
    run(g, 0, TAMING_CONFIG.breakMs, () => corner);
    const events = run(g, TAMING_CONFIG.breakMs + 16, 20_000, () => g.snapshot().cat ?? corner);
    expect(events.tamed).toEqual([]);
  });
});

describe('the cat, with a treat in hand', () => {
  /** A game whose ranger has picked up a treat, the cat on screen, at time `now`. */
  function carrying(typeId = 'void-tabby') {
    const g = treatGame({ treatEveryMs: 100, maxTreats: 1, treatLifeMs: 60_000 }, typeId);
    run(g, 0, TAMING_CONFIG.breakMs, () => corner);
    const treat = g.snapshot().treats[0];
    const now = TAMING_CONFIG.breakMs + 16;
    expect(g.tick(now, treat).picked).toBe(treat.kind);
    return { g, now, at: { x: treat.x, y: treat.y } };
  }

  it('stops attacking and fleeing, and comes to the ranger', () => {
    const { g, now, at } = carrying();
    const before = distance(g.snapshot().cat!, at);
    const events = run(g, now + 16, now + 400, () => at);
    expect(events.attacks).toEqual([]);
    // Still on its way (not tamed yet), and nearer.
    const cat = g.snapshot().cat;
    expect(cat).not.toBeNull();
    expect(cat!.doing).toBe('coming');
    expect(distance(cat!, at)).toBeLessThan(before);
  });

  it('is tamed when they touch; the treat is used up, and the next cat comes', () => {
    const { g, now, at } = carrying();
    const events = run(g, now + 16, now + 15_000, () => at);
    expect(events.tamed).toEqual(['void-tabby']);
    expect(events.attacks).toEqual([]);
    expect(g.snapshot().tamed).toEqual(['void-tabby']);
    expect(g.snapshot().carrying).toBeNull();
    // A new cat, which keeps away again: no treat in hand.
    run(g, now + 15_016, now + 15_000 + TAMING_CONFIG.breakMs + 32, () => corner);
    expect(g.snapshot().cat).not.toBeNull();
    expect(g.snapshot().cat!.doing).not.toBe('coming');
  });

  it('even a cat mid-dodge comes once its dodge ends', () => {
    const g = treatGame({ treatEveryMs: 100, maxTreats: 1, treatLifeMs: 60_000 }, 'gravi-coon');
    run(g, 0, TAMING_CONFIG.breakMs, () => corner);
    const cat = g.snapshot().cat!;
    // Startle it, then fetch the treat while it lumbers off.
    let now = TAMING_CONFIG.breakMs + 16;
    g.tick(now, { x: cat.x - 40, y: cat.y });
    const treat = g.snapshot().treats[0];
    now += 16;
    expect(g.tick(now, treat).picked).toBe(treat.kind);
    const events = run(g, now + 16, now + 15_000, () => treat);
    expect(events.tamed).toEqual(['gravi-coon']);
  });
});

describe('taming on a touch screen', () => {
  it('a ranger walked with the movement pad carries a treat to the cat and tames it', () => {
    const g = treatGame({ treatEveryMs: 100, maxTreats: 1, treatLifeMs: 60_000 });
    const pad = { x: 100, y: 700 };
    let ranger = { x: 600, y: 400 };
    let tamed: string | null = null;
    for (let now = 0; now < 30_000 && !tamed; now += 16) {
      const { treats, carrying } = g.snapshot();
      // The thumb pushes the pad towards the treat; with one in hand it lets go.
      const target = carrying ? null : (treats[0] ?? null);
      const thumb = target
        ? {
            x: pad.x + Math.sign(Math.round(target.x - ranger.x)) * 50,
            y: pad.y + Math.sign(Math.round(target.y - ranger.y)) * 50,
          }
        : null;
      const way = padDirection(thumb, pad, PAD_SIZE / 2);
      const step = (TAMING_CONFIG.rangerSpeed * 16) / 1000;
      ranger = { x: ranger.x + way.x * step, y: ranger.y + way.y * step };
      tamed = g.tick(now, ranger).tamed;
    }
    expect(tamed).toBe('void-tabby');
  });
});

describe('never more than five cats', () => {
  it('no cat comes while the screen is full of other cats', () => {
    const g = createTaming({ random: createRandom(1), types: CAT_TYPES, viewport, now: 0 });
    for (let now = 0; now < 10_000; now += 16) g.tick(now, { x: 100, y: 100 }, 0);
    expect(g.snapshot().cat).toBeNull();
    g.tick(10_016, { x: 100, y: 100 }, 1);
    expect(g.snapshot().cat).not.toBeNull();
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
