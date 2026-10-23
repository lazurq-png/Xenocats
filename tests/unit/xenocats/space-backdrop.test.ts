import { describe, expect, it } from 'vitest';
import { STAR_LAYERS, hash, starAt } from '@/app/ui/xenocats/space-backdrop';

describe('the space backdrop', () => {
  it('is the same sky each time: a star is where its cell says, inside the cell', () => {
    for (let layer = 0; layer < STAR_LAYERS.length; layer++) {
      for (const [cx, cy] of [
        [0, 0],
        [-3, 7],
        [120, -45],
      ]) {
        const star = starAt(cx, cy, layer, 0);
        expect(starAt(cx, cy, layer, 0)).toEqual(star);
        expect(star.x).toBeGreaterThanOrEqual(0);
        expect(star.x).toBeLessThan(STAR_LAYERS[layer].cell);
        expect(star.y).toBeGreaterThanOrEqual(0);
        expect(star.y).toBeLessThan(STAR_LAYERS[layer].cell);
        expect(star.bright).toBeGreaterThan(0.3);
        expect(star.bright).toBeLessThanOrEqual(1);
      }
    }
  });

  it('scatters the stars: neighbouring cells differ, and the hash spreads over [0, 1)', () => {
    expect(starAt(0, 0, 1, 0)).not.toEqual(starAt(1, 0, 1, 0));
    expect(starAt(0, 0, 1, 0)).not.toEqual(starAt(0, 1, 1, 0));
    const values = Array.from({ length: 400 }, (_, i) => hash(i, i * 7 - 50, 3));
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThan(1);
    // Every tenth of the range is reached.
    const tenths = new Set(values.map((v) => Math.floor(v * 10)));
    expect(tenths.size).toBe(10);
  });

  it('draws fewer layers in light graphics, never twinkling, the nearest kept', () => {
    const light = STAR_LAYERS.filter((l) => l.inLight);
    expect(light.length).toBeGreaterThan(0);
    expect(light.length).toBeLessThan(STAR_LAYERS.length);
    expect(light.some((l) => l.twinkle)).toBe(false);
    // The nearest slides with the ground, so his walk still shows.
    expect(STAR_LAYERS.at(-1)).toMatchObject({ parallax: 1, inLight: true });
  });
});
