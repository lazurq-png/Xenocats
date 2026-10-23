import { describe, expect, it } from 'vitest';
import {
  MEGA_PATTERNS,
  MEGA_SHAPE,
  burstAngles,
  matriarchPatternAt,
  megaPatternAt,
  steer,
} from '@/app/ui/xenocats/cat-attacks';

describe('the cats’ attacks, as geometry', () => {
  it('a Mega Cat’s patterns go round, each warned its own way', () => {
    expect([0, 1, 2, 3, 4].map(megaPatternAt)).toEqual([
      'pounce',
      'charge',
      'volley',
      'pounce',
      'charge',
    ]);
    expect(MEGA_PATTERNS.map((p) => MEGA_SHAPE[p])).toEqual(['blast', 'dash', 'burst']);
    expect([0, 1, 2, 3].map(matriarchPatternAt)).toEqual(['summon', 'volley', 'summon', 'volley']);
  });

  it('a burst flies evenly round, its first shot at the aim', () => {
    const angles = burstAngles(0.3, 8);
    expect(angles).toHaveLength(8);
    expect(angles[0]).toBeCloseTo(0.3);
    for (let i = 1; i < 8; i++) expect(angles[i] - angles[i - 1]).toBeCloseTo(Math.PI / 4);
  });

  it('steering turns toward the point by at most its turn, and keeps the speed', () => {
    // Heading east at 100, the point due north: a small turn only, towards it (y grows down).
    const v = steer(100, 0, 0, -50, 0.1);
    expect(Math.hypot(v.vx, v.vy)).toBeCloseTo(100);
    expect(Math.atan2(v.vy, v.vx)).toBeCloseTo(-0.1);
    // Enough turn: it heads straight at it.
    const w = steer(100, 0, 0, 50, 4);
    expect(Math.atan2(w.vy, w.vx)).toBeCloseTo(Math.PI / 2);
    // Turning the short way round, across the back.
    const x = steer(-100, 1, -100, -1, 0.5);
    expect(x.vx).toBeLessThan(0);
    // Nothing to turn by, or nowhere to turn to: as it was.
    expect(steer(100, 0, 0, 50, 0)).toEqual({ vx: 100, vy: 0 });
    expect(steer(100, 0, 0, 0, 1)).toEqual({ vx: 100, vy: 0 });
  });
});
