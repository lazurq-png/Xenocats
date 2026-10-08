import { describe, expect, it } from 'vitest';
import { type Cat, createCatEngine } from '@/app/ui/xenocats/cat-engine';
import { CAT_TYPES } from '@/app/ui/xenocats/cat-types';
import { CAT_CONFIG } from '@/app/ui/xenocats/config';
import { createRandom } from '@/app/ui/xenocats/random';

// The cat engine played at random — cats summoned asleep and awake, clicked, the
// window resized and the intensity changed, ticks of every length, the pointer on
// and off the page, attacks that land or wait — and after every step, what must
// always hold. A seeded run: the same steps every time.

const PHASES = ['appearing', 'sleeping', 'waking', 'ready', 'attacking', 'leaving'];

/** What is wrong with the cats as they stand on a screen of `viewport`, if anything. */
function problems(cats: readonly Cat[], viewport: { width: number; height: number }) {
  const found: string[] = [];
  const { catSize, margin } = CAT_CONFIG;
  const roomy = viewport.width >= catSize + 2 * margin && viewport.height >= catSize + 2 * margin;
  if (cats.length > 5) found.push(`${cats.length} cats`);
  for (const cat of cats) {
    if (!Number.isFinite(cat.x) || !Number.isFinite(cat.y)) found.push(`cat ${cat.id} nowhere`);
    if (
      roomy &&
      (cat.x < margin ||
        cat.y < margin ||
        cat.x + catSize > viewport.width - margin + 1e-9 ||
        cat.y + catSize > viewport.height - margin + 1e-9)
    ) {
      found.push(`cat ${cat.id} off the screen`);
    }
    if (!PHASES.includes(cat.phase)) found.push(`cat ${cat.id} in phase ${cat.phase}`);
    if (cat.phase !== 'ready' && !Number.isFinite(cat.phaseEndsAt)) {
      found.push(`cat ${cat.id} ${cat.phase} for ever`);
    }
    if (cat.comboWith !== null) {
      const partner = cats.find((other) => other.id === cat.comboWith);
      if (!partner) found.push(`cat ${cat.id}'s partner is gone`);
      else if (partner.comboWith !== cat.id) found.push(`cat ${cat.id}'s partner is not`);
    }
  }
  // One combo at a time: a single pair at most.
  if (cats.filter((cat) => cat.comboWith !== null).length > 2) found.push('more than one pair');
  return found;
}

describe('the cats, played at random', () => {
  it('never more than five, all on the screen, every phase known and timed, partners paired', () => {
    const seen = new Set<string>();
    let summoned = 0;
    let poked = 0;
    let resized = 0;
    for (let seed = 1; seed <= 150; seed++) {
      const play = createRandom(seed * 7919);
      let viewport = { width: 1200, height: 800 };
      const engine = createCatEngine({
        random: createRandom(seed),
        types: CAT_TYPES,
        viewport,
        autoSpawn: play.next() < 0.5,
      });
      let now = 0;
      for (let step = 0; step < 300; step++) {
        now += play.range(5, 900);
        const roll = play.next();
        if (roll < 0.1) {
          if (engine.summon(play.pick(CAT_TYPES).id, now, null, { asleep: play.next() < 0.5 })) {
            summoned++;
          }
        } else if (roll < 0.2) {
          const cats = engine.cats();
          if (cats.length > 0) {
            const cat = cats[play.int(0, cats.length - 1)];
            if (engine.poke(engine.centreOf(cat), now)) poked++;
          }
        } else if (roll < 0.25) {
          viewport = {
            width: Math.round(play.range(60, 1600)),
            height: Math.round(play.range(60, 1000)),
          };
          engine.resize(viewport);
          resized++;
        } else if (roll < 0.27) {
          engine.configure({ maxCats: play.int(1, 5) });
        }
        const pointer =
          play.next() < 0.5
            ? { x: play.range(0, viewport.width), y: play.range(0, viewport.height) }
            : null;
        engine.tick(now, pointer, () => play.next() < 0.8);
        for (const problem of problems(engine.cats(), viewport))
          seen.add(`seed ${seed}: ${problem}`);
      }
      // And none stays for ever: given time, with the pointer on the page and every
      // attack landing, each cat on screen now (asleep, ready, paired) has left.
      const before = new Set(engine.cats().map((cat) => cat.id));
      for (let wait = 0; wait < 20; wait++) {
        now += 30_000;
        engine.tick(now, { x: 1, y: 1 }, () => true);
      }
      for (const cat of engine.cats()) {
        if (before.has(cat.id)) seen.add(`seed ${seed}: cat ${cat.id} stays (${cat.phase})`);
      }
    }
    expect([...seen]).toEqual([]);
    // It played: cats came, were clicked awake, and the screen changed size.
    expect(summoned).toBeGreaterThan(500);
    expect(poked).toBeGreaterThan(100);
    expect(resized).toBeGreaterThan(1000);
  });
});
