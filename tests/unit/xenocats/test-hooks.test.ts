import { describe, expect, it } from 'vitest';
import { WEAPONS } from '@/app/ui/xenocats/arsenal';
import { CROWD_ARSENAL, MAX_CROWD, parseTestHooks } from '@/app/ui/xenocats/test-hooks';

const fresh = () => 777;
const hooks = (search: string) => parseTestHooks(search, fresh);

describe('the URL test hooks', () => {
  it('none set: a fresh seed, time at its own pace, no early boss', () => {
    expect(hooks('')).toEqual({
      seed: 777,
      speed: 1,
      boss: null,
      fps: false,
      crowd: null,
      elite: false,
    });
  });

  it('read as set', () => {
    expect(hooks('?seed=42&speed=3&boss=2.5')).toEqual({
      seed: 42,
      speed: 3,
      boss: 2500,
      fps: false,
      crowd: null,
      elite: false,
    });
    expect(hooks('?boss=0')).toEqual({
      seed: 777,
      speed: 1,
      boss: 0,
      fps: false,
      crowd: null,
      elite: false,
    });
  });

  it('a seed that is not a whole number above 0 is no seed', () => {
    for (const seed of ['0', '-3', '1.5', 'abc', '', 'NaN', 'Infinity']) {
      expect(hooks(`?seed=${seed}`).seed, seed).toBe(777);
    }
  });

  it('time is never slowed, nor sped past 50 times', () => {
    expect(hooks('?speed=0.5').speed).toBe(1);
    expect(hooks('?speed=-4').speed).toBe(1);
    expect(hooks('?speed=abc').speed).toBe(1);
    expect(hooks('?speed=Infinity').speed).toBe(1);
    expect(hooks('?speed=100').speed).toBe(50);
    expect(hooks('?speed=1e308').speed).toBe(50);
  });

  it('the frame counter is on only for fps=1', () => {
    expect(hooks('?fps=1').fps).toBe(true);
    for (const value of ['0', '', 'true', '2', 'yes']) {
      expect(hooks(`?fps=${value}`).fps, value).toBe(false);
    }
  });

  it('every xenocat is an elite only for elite=1', () => {
    expect(hooks('?elite=1').elite).toBe(true);
    for (const value of ['0', '', 'true', '2'])
      expect(hooks(`?elite=${value}`).elite, value).toBe(false);
  });

  it('a crowd is a whole number of cats from 1, at most 6000', () => {
    expect(hooks('?crowd=300').crowd).toBe(300);
    expect(hooks('?crowd=1').crowd).toBe(1);
    expect(hooks('?crowd=99999').crowd).toBe(MAX_CROWD);
    expect(MAX_CROWD).toBe(6000);
    for (const crowd of ['0', '-5', '2.5', 'abc', '', 'NaN', 'Infinity']) {
      expect(hooks(`?crowd=${crowd}`).crowd, crowd).toBeNull();
    }
  });

  it('a crowd arms the Keeper with six evolved weapons', () => {
    expect(CROWD_ARSENAL).toHaveLength(6);
    expect(new Set(CROWD_ARSENAL).size).toBe(6);
    for (const id of CROWD_ARSENAL) expect(WEAPONS[id], id).toBeDefined();
  });

  it('a boss time that is not a time is no early boss', () => {
    for (const boss of ['-1', 'abc', 'Infinity', '1e400']) {
      expect(hooks(`?boss=${boss}`).boss, boss).toBeNull();
    }
    // Absurdly late is harmless: a boss at Infinity never comes.
    expect(hooks('?boss=1e306').boss).toBe(Infinity);
  });
});
