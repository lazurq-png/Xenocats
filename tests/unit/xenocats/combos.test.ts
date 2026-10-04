import { describe, expect, it } from 'vitest';
import { type Cat, type TryAttack, createCatEngine } from '@/app/ui/xenocats/cat-engine';
import { CAT_TYPES, catTypeById } from '@/app/ui/xenocats/cat-types';
import { COMBOS, type Combo, findCombo } from '@/app/ui/xenocats/combos';
import { CAT_CONFIG } from '@/app/ui/xenocats/config';
import {
  type CursorLook,
  type Effect,
  ICE,
  KNOCKBACK_DISTANCE,
  MAX_EFFECT_MS,
  knockback,
  restingLook,
} from '@/app/ui/xenocats/effects';
import { PAGE_HITS } from '@/app/ui/xenocats/page-hits';
import { createRandom } from '@/app/ui/xenocats/random';

const viewport = { width: 1200, height: 800 };
const cat = { x: 500, y: 400 };
const start = { x: 600, y: 400 };

/** Runs `effect` for its whole duration, the real pointer moving by `move` each frame. */
function run(effect: Effect, move = { x: 0, y: 0 }, roll = 0.3) {
  const looks: CursorLook[] = [];
  let real = start;
  let previous = restingLook(real);
  let state: unknown;
  for (let elapsed = 0; elapsed < effect.durationMs; elapsed += 16) {
    const delta = elapsed === 0 ? { x: 0, y: 0 } : move;
    real = { x: real.x + delta.x, y: real.y + delta.y };
    const frame = effect.step({
      real,
      delta,
      previous,
      start,
      cat,
      elapsed,
      dt: 16,
      viewport,
      roll,
      state,
    });
    state = frame.state;
    previous = frame.look;
    looks.push(frame.look);
  }
  return looks;
}

const comboBy = (id: string) => COMBOS.find((c) => c.effect.id === id)!;
const effectIds = new Set(CAT_TYPES.map((type) => type.effect.id));

describe('the combos', () => {
  it('at least five, each from two attacks cats really have, none twice', () => {
    expect(COMBOS.length).toBeGreaterThanOrEqual(5);
    const pairs = COMBOS.map(({ pair }) => [...pair].sort().join('+'));
    expect(new Set(pairs).size).toBe(COMBOS.length);
    for (const { pair, effect } of COMBOS) {
      expect(effectIds.has(pair[0]), pair[0]).toBe(true);
      expect(effectIds.has(pair[1]), pair[1]).toBe(true);
      expect(pair[0]).not.toBe(pair[1]);
      expect(effect.durationMs).toBeGreaterThan(0);
      expect(effect.durationMs).toBeLessThanOrEqual(MAX_EFFECT_MS);
      expect(effect.name).not.toBe('');
      expect(effect.description).not.toBe('');
    }
  });

  it('each hits the page too, like every attack', () => {
    for (const { effect } of COMBOS) expect(PAGE_HITS[effect.id], effect.id).toBeDefined();
  });

  it('an angry combo throws the cursor further only where its parts do', () => {
    expect(comboBy('ghost-jump').effect.amplify).toBe('offset');
    expect(comboBy('static-fog').effect.amplify).toBe('offset');
    expect(comboBy('ice-puck').effect.amplify).toBeUndefined();
    expect(comboBy('slingshot').effect.amplify).toBeUndefined();
  });

  it('are found from either cat, and only for their pair', () => {
    for (const combo of COMBOS) {
      expect(findCombo(combo.pair[0], combo.pair[1])).toBe(combo);
      expect(findCombo(combo.pair[1], combo.pair[0])).toBe(combo);
    }
    expect(findCombo('freeze', 'vanish')).toBeUndefined();
    expect(findCombo('freeze', 'freeze')).toBeUndefined();
  });

  it('Freeze + Bounce = Ice puck: a frosted cursor that skids and ricochets', () => {
    const looks = run(comboBy('ice-puck').effect, { x: 0, y: 0 });
    for (const look of looks) expect(look.tint).toBe(ICE);
    // It moves on its own, with the mouse still.
    const travelled = looks.reduce(
      (sum, look, i) =>
        i ? sum + Math.hypot(look.x - looks[i - 1].x, look.y - looks[i - 1].y) : 0,
      0
    );
    expect(travelled).toBeGreaterThan(300);
  });

  it('Knockback + Magnet = Slingshot: flung away from the cat, then pulled back to it', () => {
    const combo = comboBy('slingshot');
    expect(combo.effect.durationMs).toBe(knockback.durationMs + 4000);
    const looks = run(combo.effect);
    const dist = (look: CursorLook) => Math.hypot(look.x - cat.x, look.y - cat.y);
    const flung = looks[Math.floor(knockback.durationMs / 16) - 1];
    expect(dist(flung)).toBeGreaterThan(
      Math.hypot(start.x - cat.x, start.y - cat.y) + KNOCKBACK_DISTANCE / 2
    );
    expect(dist(looks.at(-1)!)).toBeLessThan(dist(flung) / 2);
  });

  it('Reverse + Drunk = Hangover: moves against the mouse, and sways', () => {
    const looks = run(comboBy('hangover').effect, { x: 3, y: 0 });
    // The mouse went right; the cursor went left overall.
    expect(looks.at(-1)!.x).toBeLessThan(start.x - 50);
    // …and its height sways though the mouse moved only sideways.
    const ys = looks.map((look) => look.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(20);
  });

  it('Vanish + Teleport = Ghost jump: a faint cursor that jumps about', () => {
    const looks = run(comboBy('ghost-jump').effect);
    for (const look of looks) expect(look.opacity).toBeCloseTo(0.35);
    const spots = new Set(looks.map((look) => `${Math.round(look.x)},${Math.round(look.y)}`));
    expect(spots.size).toBeGreaterThanOrEqual(3);
  });

  it('Tiny + Giant = Pulsar: swells to giant and shrinks to a speck, again and again', () => {
    const scales = run(comboBy('pulsar').effect).map((look) => look.scale);
    expect(Math.max(...scales)).toBeGreaterThan(3.5);
    expect(Math.min(...scales)).toBeLessThan(0.3);
    const peaks = scales.filter(
      (s, i) => i > 0 && i < scales.length - 1 && s > scales[i - 1] && s >= scales[i + 1]
    );
    expect(peaks.length).toBeGreaterThanOrEqual(3);
  });

  it('Jitter + Blur = Static fog: a blurred cursor fizzing about the pointer', () => {
    const looks = run(comboBy('static-fog').effect);
    for (const look of looks.slice(0, 50)) expect(look.blur).toBeGreaterThan(0);
    const spots = new Set(looks.slice(0, 50).map((look) => `${look.x},${look.y}`));
    expect(spots.size).toBeGreaterThan(5);
    for (const look of looks)
      expect(Math.hypot(look.x - start.x, look.y - start.y)).toBeLessThan(40);
  });
});

/** An engine with two sleeping cats of `a` and `b` side by side (centres 100 px apart). */
function pairOfSleepers(a: string, b: string, gap = 100) {
  const engine = createCatEngine({
    random: createRandom(9),
    types: CAT_TYPES,
    viewport,
    autoSpawn: false,
  });
  const one = engine.summon(a, 0, null, { asleep: true })!;
  const two = engine.summon(b, 0, null, { asleep: true })!;
  Object.assign(one, { x: 300, y: 300 });
  Object.assign(two, { x: 300 + gap, y: 300 });
  const entrance = Math.max(catTypeById(a)!.entranceMs, catTypeById(b)!.entranceMs);
  engine.tick(entrance, null, () => false);
  expect([one.phase, two.phase]).toEqual(['sleeping', 'sleeping']);
  return { engine, one, two, at: entrance };
}

const centre = (c: Cat) => ({ x: c.x + CAT_CONFIG.catSize / 2, y: c.y + CAT_CONFIG.catSize / 2 });

/** Ticks to `until`, recording every attack accepted. */
function attacks(engine: ReturnType<typeof createCatEngine>, from: number, until: number) {
  const seen: { cat: Cat; centre: { x: number; y: number }; combo?: Combo }[] = [];
  const accept: TryAttack = (c, _type, at, combo) => {
    seen.push({ cat: { ...c }, centre: at, combo });
    return true;
  };
  for (let now = from; now <= until; now += 16) engine.tick(now, null, accept);
  return seen;
}

describe('cats pairing up for a combo', () => {
  it('two cats waking close together attack once, together, with the combo', () => {
    // Cryo Persian (freeze) and Pinball Devon (bounce): an ice puck.
    const { engine, one, two, at } = pairOfSleepers('cryo-persian', 'pinball-devon');
    engine.poke(centre(one), at + 100);
    engine.poke(centre(two), at + 100 + CAT_CONFIG.comboWindowMs - 10);
    expect(one.combo).toBe('ice-puck');
    expect(two.comboWith).toBe(one.id);
    const seen = attacks(engine, at + 200, at + 200 + CAT_CONFIG.comboWindowMs + 3000);
    expect(seen).toHaveLength(1);
    expect(seen[0].combo?.effect.id).toBe('ice-puck');
    // It comes from between the two cats.
    expect(seen[0].centre).toEqual({
      x: (centre(one).x + centre(two).x) / 2,
      y: centre(one).y,
    });
    expect(engine.cats().every((c) => c.phase === 'attacking' || c.phase === 'leaving')).toBe(true);
  });

  it('two cats that wake on their own close together pair up too', () => {
    const engine = createCatEngine({
      random: createRandom(9),
      types: CAT_TYPES,
      viewport,
      autoSpawn: false,
      // Both sleep (almost) exactly 5 s.
      config: { sleepMs: [5000, 5001] },
    });
    const one = engine.summon('pulsar-siamese', 0, null, { asleep: true })!;
    const two = engine.summon('magneto-bengal', 0, null, { asleep: true })!;
    Object.assign(one, { x: 300, y: 300 });
    Object.assign(two, { x: 400, y: 300 });
    const seen = attacks(engine, 0, 12_000);
    expect(seen).toHaveLength(1);
    expect(seen[0].combo?.effect.id).toBe('slingshot');
  });

  it('too far apart in time: no combo, each attacks alone', () => {
    const { engine, one, two, at } = pairOfSleepers('cryo-persian', 'pinball-devon');
    engine.poke(centre(one), at + 100);
    engine.poke(centre(two), at + 100 + CAT_CONFIG.comboWindowMs + 10);
    expect(one.combo).toBeNull();
    const seen = attacks(engine, at + 200, at + 12_000);
    expect(seen.map((s) => s.combo)).toEqual([undefined, undefined]);
  });

  it('too far apart in place: no combo', () => {
    const { engine, one, two, at } = pairOfSleepers(
      'cryo-persian',
      'pinball-devon',
      CAT_CONFIG.comboDistance + 10
    );
    engine.poke(centre(one), at + 100);
    engine.poke(centre(two), at + 150);
    expect(one.combo).toBeNull();
    expect(two.combo).toBeNull();
  });

  it('cats whose attacks have no combo do not pair', () => {
    const { engine, one, two, at } = pairOfSleepers('void-tabby', 'cryo-persian');
    engine.poke(centre(one), at + 100);
    engine.poke(centre(two), at + 150);
    expect(one.comboWith).toBeNull();
  });

  it('only one combo at a time', () => {
    const engine = createCatEngine({
      random: createRandom(9),
      types: CAT_TYPES,
      viewport,
      autoSpawn: false,
    });
    const ids = ['cryo-persian', 'pinball-devon', 'pulsar-siamese', 'magneto-bengal'];
    const four = ids.map((id) => engine.summon(id, 0, null, { asleep: true })!);
    four.forEach((c, i) =>
      Object.assign(c, { x: 200 + (i % 2) * 90, y: 200 + Math.floor(i / 2) * 90 })
    );
    engine.tick(2000, null, () => false);
    for (const c of four) engine.poke(centre(c), 2100);
    expect(four.filter((c) => c.combo !== null)).toHaveLength(2);
    expect(four[0].combo).toBe('ice-puck');
    expect(four[2].combo).toBeNull();
  });
});
