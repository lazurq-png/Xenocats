// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { CatSprite } from '@/app/ui/xenocats/cat-sprite';
import { CAT_TYPES } from '@/app/ui/xenocats/cat-types';

afterEach(() => cleanup());

describe('CatSprite', () => {
  it.each(CAT_TYPES.map((type) => [type.name, type] as const))(
    'draws %s awake and asleep, with its eyes (and antenna, if it has one) glowing',
    (_name, type) => {
      const withoutAntenna = { ...type.look, antenna: 'none' } as const;
      for (const pose of ['awake', 'asleep'] as const) {
        const { container } = render(
          <CatSprite palette={type.palette} look={type.look} pose={pose} />
        );
        const svg = container.querySelector('svg')!;
        expect(svg.getAttribute('viewBox')).toBe('0 0 72 72');
        expect(svg.querySelector('.xenocat-body')).not.toBeNull();
        if (pose === 'awake') {
          const glows = svg.querySelectorAll('.xenocat-glow').length;
          const eyeGlows =
            renderToStaticMarkup(
              <CatSprite palette={type.palette} look={withoutAntenna} pose="awake" />
            ).split('xenocat-glow').length - 1;
          expect(eyeGlows).toBeGreaterThan(0);
          if (type.look.antenna === 'none') expect(glows).toBe(eyeGlows);
          else expect(glows).toBeGreaterThan(eyeGlows);
        }
        cleanup();
      }
    }
  );

  it('keeps antennae on the first three cats only', () => {
    expect(
      CAT_TYPES.filter((type) => type.look.antenna !== 'none').map((type) => type.number)
    ).toEqual([1, 2, 3]);
  });

  it('draws every cat differently, awake and asleep', () => {
    for (const pose of ['awake', 'asleep'] as const) {
      const drawings = CAT_TYPES.map((type) =>
        renderToStaticMarkup(<CatSprite palette={type.palette} look={type.look} pose={pose} />)
      );
      expect(new Set(drawings).size).toBe(CAT_TYPES.length);
    }
  });

  it('still, marks the drawing so its glowing parts do not pulse', () => {
    const type = CAT_TYPES[0];
    const { container } = render(
      <CatSprite palette={type.palette} look={type.look} pose="awake" still />
    );
    const svg = container.querySelector('svg')!;
    expect(svg.classList.contains('xenocat-still')).toBe(true);
    // The glowing parts are still drawn; only their animation stops (global.css).
    expect(svg.querySelectorAll('.xenocat-glow').length).toBeGreaterThan(0);
  });

  it('sleeping looks different from awake', () => {
    const type = CAT_TYPES[0];
    const awake = renderToStaticMarkup(
      <CatSprite palette={type.palette} look={type.look} pose="awake" />
    );
    const asleep = renderToStaticMarkup(
      <CatSprite palette={type.palette} look={type.look} pose="asleep" />
    );
    expect(asleep).not.toBe(awake);
  });
});
