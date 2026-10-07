import { describe, expect, it } from 'vitest';
import { parseTestHooks } from '@/app/ui/xenocats/test-hooks';

const fresh = () => 777;
const hooks = (search: string) => parseTestHooks(search, fresh);

describe('the URL test hooks', () => {
  it('none set: a fresh seed, time at its own pace, no early boss', () => {
    expect(hooks('')).toEqual({ seed: 777, speed: 1, boss: null });
  });

  it('read as set', () => {
    expect(hooks('?seed=42&speed=3&boss=2.5')).toEqual({ seed: 42, speed: 3, boss: 2500 });
    expect(hooks('?boss=0')).toEqual({ seed: 777, speed: 1, boss: 0 });
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

  it('a boss time that is not a time is no early boss', () => {
    for (const boss of ['-1', 'abc', 'Infinity', '1e400']) {
      expect(hooks(`?boss=${boss}`).boss, boss).toBeNull();
    }
    // Absurdly late is harmless: a boss at Infinity never comes.
    expect(hooks('?boss=1e306').boss).toBe(Infinity);
  });
});
