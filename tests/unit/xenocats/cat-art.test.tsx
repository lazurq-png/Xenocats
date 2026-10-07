// @vitest-environment jsdom
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CAT_ART, catArt } from '@/app/ui/xenocats/cat-art';
import { CatSprite } from '@/app/ui/xenocats/cat-sprite';
import { CAT_TYPES, catTypeById } from '@/app/ui/xenocats/cat-types';

afterEach(() => cleanup());

describe('CAT_ART', () => {
  it('only names cats on the roster, with files that exist', () => {
    for (const [id, poses] of Object.entries(CAT_ART)) {
      expect(catTypeById(id), id).toBeDefined();
      for (const src of Object.values(poses)) {
        expect(existsSync(join(process.cwd(), 'public', src!)), src).toBe(true);
      }
    }
  });
});

describe('catArt', () => {
  it('gives a pose its artwork, and nothing for cats without any', () => {
    expect(catArt('void-tabby', 'awake')).toBe('/xenocats/cats/void-tabby-awake.webp');
    expect(catArt('void-tabby', 'asleep')).toBe('/xenocats/cats/void-tabby-asleep.webp');
    expect(catArt('no-such-cat', 'awake')).toBeUndefined();
  });

  it('gives every cat on the roster artwork for both poses', () => {
    for (const type of CAT_TYPES) {
      expect(catArt(type.id, 'awake', { wholeSet: true }), type.id).toBeDefined();
    }
  });

  it('gives an eyes-first cat an eyes overlay', () => {
    for (const type of CAT_TYPES.filter((t) => t.entrance === 'eyes-first')) {
      expect(catArt(type.id, 'eyes', { wholeSet: true }), type.id).toBeDefined();
    }
  });

  it('with wholeSet, gives a cat with both poses its artwork', () => {
    expect(catArt('void-tabby', 'awake', { wholeSet: true })).toBeDefined();
    expect(catArt('void-tabby', 'asleep', { wholeSet: true })).toBeDefined();
  });

  it('with wholeSet, holds the artwork back until the cat has both poses', () => {
    // A made-up half-done cat, so the test outlives the real ones being finished.
    const art = CAT_ART as Record<string, Partial<Record<'awake' | 'asleep', string>>>;
    art['half-done'] = { awake: '/half-done-awake.webp' };
    try {
      expect(catArt('half-done', 'awake')).toBeDefined();
      expect(catArt('half-done', 'awake', { wholeSet: true })).toBeUndefined();
      expect(catArt('half-done', 'asleep', { wholeSet: true })).toBeUndefined();
    } finally {
      delete art['half-done'];
    }
  });
});

describe('CatSprite with artwork', () => {
  const type = catTypeById('void-tabby')!;

  it('draws the image inside the breathing body, glowing only while awake', () => {
    for (const pose of ['awake', 'asleep'] as const) {
      const { container } = render(
        <CatSprite palette={type.palette} look={type.look} pose={pose} art="/cat.webp" size={64} />
      );
      expect(container.querySelector('svg')).toBeNull();
      const img = container.querySelector('.xenocat-body > img')!;
      expect(img.getAttribute('src')).toBe('/cat.webp');
      expect(img.getAttribute('width')).toBe('64');
      expect(img.classList.contains('xenocat-art-glow')).toBe(pose === 'awake');
      cleanup();
    }
  });

  it('draws the eyes overlay over the body as its own layer, only while awake', () => {
    for (const pose of ['awake', 'asleep'] as const) {
      const { container } = render(
        <CatSprite
          palette={type.palette}
          look={type.look}
          pose={pose}
          art="/cat.webp"
          eyes="/eyes.webp"
        />
      );
      const eyes = container.querySelector('.xenocat-body > img.xenocat-eyes');
      if (pose === 'awake') {
        expect(eyes!.getAttribute('src')).toBe('/eyes.webp');
        // The body image stays outside `.xenocat-eyes`, so the staged entrance
        // can fade it in separately.
        expect(container.querySelector('.xenocat-body > img:not(.xenocat-eyes)')).not.toBeNull();
      } else {
        expect(eyes).toBeNull();
      }
      cleanup();
    }
  });

  it('still, holds the glow steady instead of pulsing it', () => {
    const { container } = render(
      <CatSprite palette={type.palette} look={type.look} pose="awake" art="/cat.webp" still />
    );
    const img = container.querySelector('img')!;
    expect(img.classList.contains('xenocat-art-glow-still')).toBe(true);
    expect(img.classList.contains('xenocat-art-glow')).toBe(false);
  });
});
