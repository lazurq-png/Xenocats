// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CAT_TYPES } from '@/app/ui/xenocats/cat-types';
import {
  GUIDE_KEY,
  addStat,
  entryFor,
  getGuide,
  isEmptyGuide,
  parseStats,
  recordStat,
  subscribeGuide,
} from '@/app/ui/xenocats/field-guide';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('stats', () => {
  it('count per type and field', () => {
    let stats = addStat({}, 'void-tabby', 'met');
    stats = addStat(stats, 'void-tabby', 'met');
    stats = addStat(stats, 'void-tabby', 'survived');
    stats = addStat(stats, 'gravi-coon', 'met');
    expect(stats).toEqual({
      'void-tabby': { met: 2, survived: 1 },
      'gravi-coon': { met: 1, survived: 0 },
    });
  });

  it('read back what was stored, dropping anything malformed or unknown', () => {
    expect(parseStats(null, CAT_TYPES)).toEqual({});
    expect(parseStats('{', CAT_TYPES)).toEqual({});
    expect(parseStats('[]', CAT_TYPES)).toEqual({});
    expect(
      parseStats(
        JSON.stringify({
          'void-tabby': { met: 3, survived: 1 },
          'gravi-coon': { met: -2, survived: 'x' },
          'cryo-persian': 7,
          'no-such-cat': { met: 1, survived: 1 },
          'pulsar-siamese': { met: 1.5, survived: 2 },
        }),
        CAT_TYPES
      )
    ).toEqual({
      'void-tabby': { met: 3, survived: 1 },
      'pulsar-siamese': { met: 0, survived: 2 },
    });
  });
});

describe('the guide', () => {
  it('is empty for a new visitor, every cat at zero', () => {
    const guide = getGuide();
    expect(isEmptyGuide(guide)).toBe(true);
    for (const type of CAT_TYPES) {
      expect(entryFor(guide, type.id)).toEqual({ met: 0, survived: 0 });
    }
  });

  it('records meetings and survived attacks, and tells subscribers', () => {
    const onChange = vi.fn();
    const unsubscribe = subscribeGuide(onChange);
    recordStat('void-tabby', 'met');
    recordStat('void-tabby', 'survived');
    expect(onChange).toHaveBeenCalledTimes(2);
    const guide = getGuide();
    expect(isEmptyGuide(guide)).toBe(false);
    expect(entryFor(guide, 'void-tabby')).toEqual({ met: 1, survived: 1 });
    expect(JSON.parse(localStorage.getItem(GUIDE_KEY)!)).toEqual({
      'void-tabby': { met: 1, survived: 1 },
    });
    unsubscribe();
    recordStat('void-tabby', 'met');
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('ignores unknown cat types', () => {
    recordStat('no-such-cat', 'met');
    expect(localStorage.length).toBe(0);
  });

  it('returns the same object until something changes (as React requires)', () => {
    const first = getGuide();
    expect(getGuide()).toBe(first);
    recordStat('gravi-coon', 'met');
    const second = getGuide();
    expect(second).not.toBe(first);
    expect(getGuide()).toBe(second);
  });

  it('carries on without storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => recordStat('void-tabby', 'met')).not.toThrow();
    expect(isEmptyGuide(getGuide())).toBe(true);
  });
});
