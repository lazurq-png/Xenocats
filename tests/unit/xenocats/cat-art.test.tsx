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
  const withAwakeOnly = Object.keys(CAT_ART).find((id) => CAT_ART[id].awake && !CAT_ART[id].asleep);

  it('gives a pose its artwork, and nothing for cats without any', () => {
    expect(catArt('void-tabby', 'awake')).toBe('/xenocats/cats/void-tabby-awake.webp');
    const withoutArt = CAT_TYPES.find((type) => !CAT_ART[type.id])!;
    expect(catArt(withoutArt.id, 'awake')).toBeUndefined();
  });

  it('with wholeSet, holds the artwork back until the cat has both poses', () => {
    expect(withAwakeOnly).toBeDefined();
    expect(catArt(withAwakeOnly!, 'awake')).toBeDefined();
    expect(catArt(withAwakeOnly!, 'awake', { wholeSet: true })).toBeUndefined();
    expect(catArt(withAwakeOnly!, 'asleep', { wholeSet: true })).toBeUndefined();
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
});
