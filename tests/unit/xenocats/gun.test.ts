import { describe, expect, it } from 'vitest';
import { CAT_TYPES } from '@/app/ui/xenocats/cat-types';
import { type CursorLook, restingLook } from '@/app/ui/xenocats/effects';
import {
  BOUNCE_TIMES,
  FALL_GRAVITY,
  HEAVY_RELOAD,
  HEAVY_SPEED,
  JAMMING,
  SPREAD,
  shotFor,
} from '@/app/ui/xenocats/gun';
import { createRandom } from '@/app/ui/xenocats/random';
import { NORMAL_SHOT } from '@/app/ui/xenocats/survival';

const ranger: CursorLook = restingLook({ x: 600, y: 400 });
const aim = { x: 800, y: 400 };
const random = () => createRandom(7);
const angle = (shot: { from: { x: number; y: number }; to: { x: number; y: number } }) =>
  Math.atan2(shot.to.y - shot.from.y, shot.to.x - shot.from.x);

describe('the gun under a cat’s attack', () => {
  it('fires a normal beam from the ranger at the aim when nothing runs', () => {
    expect(shotFor(null, ranger, aim, random())).toEqual({
      from: { x: 600, y: 400 },
      to: aim,
      style: { ...NORMAL_SHOT, tint: undefined },
    });
  });

  it('every cat’s attack leaves the gun firing, unless it jams it', () => {
    for (const type of CAT_TYPES) {
      const shot = shotFor(type.effect.id, ranger, aim, random());
      if (JAMMING.has(type.effect.id)) expect(shot).toBeNull();
      else expect(shot).not.toBeNull();
    }
    expect(JAMMING.has('freeze')).toBe(true);
  });

  it('beams take on the ranger’s size, within limits, and its look', () => {
    const tiny = shotFor('tiny', { ...ranger, scale: 0.25 }, aim, random())!;
    expect(tiny.style.scale).toBe(0.25);
    const giant = shotFor('giant', { ...ranger, scale: 4 }, aim, random())!;
    expect(giant.style.scale).toBe(2);
    const vanished = shotFor('vanish', { ...ranger, visible: false }, aim, random())!;
    expect(vanished.style.opacity).toBe(0);
    const blurred = shotFor('blur', { ...ranger, blur: 4, opacity: 0.5 }, aim, random())!;
    expect(blurred.style).toMatchObject({ blur: 4, opacity: 0.5 });
    const iced = shotFor(null, { ...ranger, tint: '#7dd3fc' }, aim, random())!;
    expect(iced.style.tint).toBe('#7dd3fc');
  });

  it('heavy reloads slowly and fires slow beams', () => {
    const shot = shotFor('heavy', ranger, aim, random())!;
    expect(shot.style.reload).toBe(HEAVY_RELOAD);
    expect(shot.style.speed).toBe(HEAVY_SPEED);
  });

  it('reverse fires the other way', () => {
    const shot = shotFor('reverse', ranger, aim, random())!;
    expect(shot.to).toEqual({ x: 400, y: 400 });
  });

  it('jitter and drunk throw the shot off the aim, within their spread', () => {
    for (const id of ['jitter', 'drunk']) {
      const r = random();
      let off = 0;
      for (let i = 0; i < 50; i++) {
        const shot = shotFor(id, ranger, aim, r)!;
        expect(Math.abs(angle(shot))).toBeLessThanOrEqual(SPREAD[id] + 1e-9);
        off = Math.max(off, Math.abs(angle(shot)));
      }
      expect(off).toBeGreaterThan(0.05);
    }
  });

  it('decoys fire from any of the rangers, along the same line', () => {
    const decoys = [
      { x: 100, y: 100 },
      { x: 900, y: 700 },
    ];
    const r = random();
    const froms = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const shot = shotFor('decoys', { ...ranger, decoys }, aim, r)!;
      froms.add(`${shot.from.x},${shot.from.y}`);
      expect(angle(shot)).toBeCloseTo(0);
    }
    expect(froms).toEqual(new Set(['600,400', '100,100', '900,700']));
  });

  it('fall drops the beams, bounce bounces them', () => {
    expect(shotFor('fall', ranger, aim, random())!.style.gravity).toBe(FALL_GRAVITY);
    expect(shotFor('bounce', ranger, aim, random())!.style.bounces).toBe(BOUNCE_TIMES);
  });

  it('axis lock fires straight sideways or straight up and down', () => {
    const sideways = shotFor('axis-lock', ranger, { x: 800, y: 450 }, random())!;
    expect(sideways.to).toEqual({ x: 800, y: 400 });
    const upright = shotFor('axis-lock', ranger, { x: 650, y: 100 }, random())!;
    expect(upright.to).toEqual({ x: 600, y: 100 });
  });
});
