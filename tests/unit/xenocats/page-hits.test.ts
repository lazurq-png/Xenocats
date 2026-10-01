// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { CAT_TYPES } from '@/app/ui/xenocats/cat-types';
import {
  HIT_ATTRIBUTE,
  PAGE_HITS,
  TEXT_ATTRIBUTE,
  applyHits,
  distanceToRect,
  hitPage,
  scrambleText,
  selectTargets,
} from '@/app/ui/xenocats/page-hits';
import { createRandom } from '@/app/ui/xenocats/random';

afterEach(() => {
  document.body.innerHTML = '';
});

const rect = (left: number, top: number, width: number, height: number) => ({
  left,
  top,
  right: left + width,
  bottom: top + height,
});

/** Gives an element a fixed layout box (jsdom has none). */
function place(element: Element, left: number, top: number, width: number, height: number) {
  element.getBoundingClientRect = () =>
    ({ ...rect(left, top, width, height), x: left, y: top, width, height }) as DOMRect;
}

describe('every attack hits the page', () => {
  it('each cat type has a page effect', () => {
    for (const type of CAT_TYPES) expect(PAGE_HITS[type.effect.id], type.id).toBeDefined();
  });
});

describe('target selection', () => {
  const none = () => false;

  it('measures the distance to the nearest edge, 0 inside', () => {
    expect(distanceToRect({ x: 5, y: 5 }, rect(0, 0, 10, 10))).toBe(0);
    expect(distanceToRect({ x: 13, y: 14 }, rect(0, 0, 10, 10))).toBe(5);
  });

  it('takes only elements within the radius, nearest first, up to the maximum', () => {
    const candidates = [
      { item: 'far', rect: rect(500, 500, 10, 10) },
      { item: 'b', rect: rect(150, 100, 10, 10) },
      { item: 'a', rect: rect(110, 100, 10, 10) },
      { item: 'c', rect: rect(190, 100, 10, 10) },
    ];
    const pointer = { x: 100, y: 105 };
    expect(selectTargets(candidates, pointer, 120, 10, none)).toEqual(['a', 'b', 'c']);
    expect(selectTargets(candidates, pointer, 120, 2, none)).toEqual(['a', 'b']);
    expect(selectTargets(candidates, pointer, 30, 10, none)).toEqual(['a']);
  });

  it('never takes an element inside one already taken, or around it', () => {
    const tree: Record<string, string[]> = { card: ['button'], row: [] };
    const contains = (a: string, b: string) => tree[a]?.includes(b) ?? false;
    const candidates = [
      { item: 'card', rect: rect(0, 0, 300, 200) },
      { item: 'button', rect: rect(20, 20, 80, 30) },
      { item: 'row', rect: rect(0, 210, 300, 20) },
    ];
    // The pointer is on the button, inside the card: the button (smaller) wins.
    expect(selectTargets(candidates, { x: 30, y: 30 }, 50, 10, contains)).toEqual(['button']);
  });

  it('ignores elements with no size (hidden)', () => {
    expect(
      selectTargets([{ item: 'x', rect: rect(0, 0, 0, 0) }], { x: 0, y: 0 }, 100, 5, none)
    ).toEqual([]);
  });

  it('hitPage skips the cats, the cursor and anything hidden from assistive technology', () => {
    document.body.innerHTML = `
      <button id="ok">Pay</button>
      <div aria-hidden="true"><button id="cat">cat</button></div>
      <div data-xenocat-ignore><p id="game">game</p></div>`;
    for (const id of ['ok', 'cat', 'game']) place(document.getElementById(id)!, 10, 10, 50, 20);
    const restore = hitPage(
      document.body,
      'jitter',
      { x: 20, y: 20 },
      { x: 0, y: 0 },
      createRandom(1)
    );
    expect(document.getElementById('ok')!.getAttribute(HIT_ATTRIBUTE)).toBe('shake');
    expect(document.getElementById('cat')!.hasAttribute(HIT_ATTRIBUTE)).toBe(false);
    expect(document.getElementById('game')!.hasAttribute(HIT_ATTRIBUTE)).toBe(false);
    restore!();
  });

  it('hitPage leaves a field being typed in alone, and skips hidden 1 px labels', () => {
    document.body.innerHTML = `
      <label id="sr" class="sr-only" for="q">Search</label>
      <div data-xenocat-card id="box"><input id="q" /></div>
      <button id="ok">Pay</button>`;
    place(document.getElementById('sr')!, 10, 10, 1, 1);
    place(document.getElementById('box')!, 0, 0, 200, 40);
    place(document.getElementById('q')!, 10, 10, 150, 20);
    place(document.getElementById('ok')!, 10, 50, 50, 20);
    (document.getElementById('q') as HTMLInputElement).focus();
    const restore = hitPage(
      document.body,
      'reverse',
      { x: 20, y: 20 },
      { x: 0, y: 0 },
      createRandom(1)
    );
    for (const id of ['sr', 'q', 'box']) {
      expect(document.getElementById(id)!.hasAttribute(HIT_ATTRIBUTE), id).toBe(false);
    }
    expect(document.getElementById('ok')!.getAttribute(HIT_ATTRIBUTE)).toBe('flip');
    restore!();
  });

  it('hits a table row as a whole', () => {
    document.body.innerHTML =
      '<table><tbody><tr id="row"><td id="a">Paid</td><td id="b">$10</td></tr></tbody></table>';
    place(document.getElementById('row')!, 0, 0, 300, 30);
    place(document.getElementById('a')!, 0, 0, 150, 30);
    place(document.getElementById('b')!, 150, 0, 150, 30);
    const restore = hitPage(
      document.body,
      'jitter',
      { x: 20, y: 10 },
      { x: 0, y: 0 },
      createRandom(1)
    );
    expect(document.getElementById('row')!.getAttribute(HIT_ATTRIBUTE)).toBe('shake');
    expect(document.getElementById('a')!.hasAttribute(HIT_ATTRIBUTE)).toBe(false);
    restore!();
  });

  it('hitPage hits nothing, and returns null, with nothing near', () => {
    document.body.innerHTML = '<button id="far">Far</button>';
    place(document.getElementById('far')!, 900, 900, 50, 20);
    expect(
      hitPage(document.body, 'jitter', { x: 0, y: 0 }, { x: 0, y: 0 }, createRandom(1))
    ).toBeNull();
  });
});

describe('scrambled text', () => {
  it('shuffles letters within words and keeps spaces and punctuation', () => {
    const text = 'Create invoice, now!';
    const out = scrambleText(text, createRandom(3));
    expect(out).not.toBe(text);
    expect(out).toHaveLength(text.length);
    expect(out.replace(/[\p{L}]/gu, '_')).toBe(text.replace(/[\p{L}]/gu, '_'));
    const sorted = (s: string) => [...s.replace(/[^\p{L}]/gu, '')].sort().join('');
    expect(sorted(out)).toBe(sorted(text));
  });
});

describe('every effect reverts exactly', () => {
  const page = `
    <div data-xenocat-card class="card" id="card">
      <h2 id="title">Total paid</h2>
      <p id="sum" style="color: red">$1,200.00</p>
      <a href="/x" id="link" class="link">Details</a>
      <button id="btn" style="transform: translateX(2px); margin: 0px">Pay now</button>
    </div>
    <input id="field" value="typing" />`;

  for (const [effectId, style] of Object.entries(PAGE_HITS)) {
    it(`${effectId} (${style.kind})`, () => {
      document.body.innerHTML = page;
      const field = document.getElementById('field') as HTMLInputElement;
      field.focus();
      const before = document.body.innerHTML;
      const texts = Array.from(document.querySelectorAll('*'), (el) => el.textContent);
      const targets = ['title', 'sum', 'link', 'btn', 'field'].map((id) =>
        document.getElementById(id)!
      );
      targets.forEach((el, i) => place(el, 10 + i * 60, 10, 50, 20));

      const restore = applyHits(targets, style, { x: 0, y: 0 }, createRandom(7));
      // Something happened to every target...
      for (const el of targets) expect(el.hasAttribute(HIT_ATTRIBUTE), el.id).toBe(true);
      // ...but the real text (what assistive technology reads) never changed,
      // focus stayed put, and the focused field got no text.
      expect(Array.from(document.querySelectorAll('*'), (el) => el.textContent)).toEqual(texts);
      expect(document.activeElement).toBe(field);
      expect(field.hasAttribute(TEXT_ATTRIBUTE)).toBe(false);
      expect(field.value).toBe('typing');

      restore();
      expect(document.body.innerHTML).toBe(before);
      expect(document.activeElement).toBe(field);
    });
  }

  it('scrambling draws other text over the real text', () => {
    document.body.innerHTML = '<p id="p">Latest invoices</p>';
    const p = document.getElementById('p')!;
    const restore = applyHits([p], PAGE_HITS.decoys, { x: 0, y: 0 }, createRandom(2));
    expect(p.getAttribute(HIT_ATTRIBUTE)).toBe('text');
    const shown = p.getAttribute(TEXT_ATTRIBUTE)!;
    expect(shown).not.toBe('Latest invoices');
    expect(shown).toHaveLength('Latest invoices'.length);
    expect(p.textContent).toBe('Latest invoices');
    restore();
    expect(p.outerHTML).toBe('<p id="p">Latest invoices</p>');
  });

  it('swapping trades the text of two elements', () => {
    document.body.innerHTML = '<p id="a">Paid</p><p id="b">Pending</p>';
    const [a, b] = [document.getElementById('a')!, document.getElementById('b')!];
    const restore = applyHits([a, b], PAGE_HITS.teleport, { x: 0, y: 0 }, createRandom(2));
    expect(a.getAttribute(TEXT_ATTRIBUTE)).toBe('Pending');
    expect(b.getAttribute(TEXT_ATTRIBUTE)).toBe('Paid');
    restore();
    expect(document.body.innerHTML).toBe('<p id="a">Paid</p><p id="b">Pending</p>');
  });

  it('a push moves away from the cat, or towards it for the magnet', () => {
    document.body.innerHTML = '<button id="b">Go</button>';
    const button = document.getElementById('b')!;
    place(button, 100, 100, 20, 20);
    const cat = { x: 0, y: 110 };
    let restore = applyHits([button], PAGE_HITS.knockback, cat, createRandom(1));
    expect(parseFloat(button.style.getPropertyValue('--xenocat-hit-dx'))).toBeGreaterThan(0);
    restore();
    restore = applyHits([button], PAGE_HITS.magnet, cat, createRandom(1));
    expect(parseFloat(button.style.getPropertyValue('--xenocat-hit-dx'))).toBeLessThan(0);
    restore();
    expect(button.outerHTML).toBe('<button id="b">Go</button>');
  });
});
