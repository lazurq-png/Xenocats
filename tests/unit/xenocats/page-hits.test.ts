// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  HIT_LEVELS,
  distanceToRect,
  pickAnywhere,
  pickTargets,
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

/** The ids of the elements a calm attack at `pointer` hits. */
const calmTargets = (pointer: { x: number; y: number }) =>
  pickTargets(document.body, pointer, HIT_LEVELS.calm.reach, createRandom(1)).map((el) => el.id);

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

  it('skips the cats, the cursor and anything hidden from assistive technology', () => {
    document.body.innerHTML = `
      <button id="ok">Pay</button>
      <div aria-hidden="true"><button id="cat">cat</button></div>
      <div data-xenocat-ignore><p id="game">game</p></div>`;
    for (const id of ['ok', 'cat', 'game']) place(document.getElementById(id)!, 10, 10, 50, 20);
    expect(calmTargets({ x: 20, y: 20 })).toEqual(['ok']);
  });

  it('leaves a field being typed in alone, and skips hidden 1 px labels', () => {
    document.body.innerHTML = `
      <label id="sr" class="sr-only" for="q">Search</label>
      <div data-xenocat-card id="box"><input id="q" /></div>
      <button id="ok">Pay</button>`;
    place(document.getElementById('sr')!, 10, 10, 1, 1);
    place(document.getElementById('box')!, 0, 0, 200, 40);
    place(document.getElementById('q')!, 10, 10, 150, 20);
    place(document.getElementById('ok')!, 10, 50, 50, 20);
    (document.getElementById('q') as HTMLInputElement).focus();
    expect(calmTargets({ x: 20, y: 20 })).toEqual(['ok']);
  });

  it('hits a table row as a whole', () => {
    document.body.innerHTML =
      '<table><tbody><tr id="row"><td id="a">Paid</td><td id="b">$10</td></tr></tbody></table>';
    place(document.getElementById('row')!, 0, 0, 300, 30);
    place(document.getElementById('a')!, 0, 0, 150, 30);
    place(document.getElementById('b')!, 150, 0, 150, 30);
    expect(calmTargets({ x: 20, y: 10 })).toEqual(['row']);
  });

  it('hits nothing with nothing near or on screen', () => {
    document.body.innerHTML = '<button id="far">Far</button>';
    // Off screen (jsdom's window is 1024 × 768).
    place(document.getElementById('far')!, 900, 900, 50, 20);
    expect(calmTargets({ x: 0, y: 0 })).toEqual([]);
  });
});

describe('attacks that move elements reach further', () => {
  const contains = (a: string, b: string) => a !== b && b.startsWith(`${a}/`);

  it('pickAnywhere adds random on-screen elements, never one already hit, inside or around one', () => {
    const candidates = [
      { item: 'panel', rect: rect(0, 0, 400, 300) },
      { item: 'panel/button', rect: rect(10, 10, 50, 20) },
      { item: 'title', rect: rect(500, 10, 100, 30) },
      { item: 'row', rect: rect(500, 400, 300, 30) },
      { item: 'offscreen', rect: rect(2000, 10, 50, 20) },
      { item: 'tiny', rect: rect(700, 10, 1, 1) },
    ];
    const viewport = { width: 1000, height: 800 };
    for (let seed = 1; seed < 20; seed++) {
      const extra = pickAnywhere(
        candidates,
        ['panel/button'],
        10,
        viewport,
        contains,
        createRandom(seed)
      );
      expect(extra.sort()).toEqual(['row', 'title']);
    }
    const one = pickAnywhere(candidates, [], 1, viewport, contains, createRandom(3));
    expect(one).toHaveLength(1);
  });

  it('calm reaches only what is near the pointer, moved less; normal and chaos reach panels and far off', () => {
    const { calm, normal, chaos } = HIT_LEVELS;
    expect(calm.reach).toMatchObject({ anywhere: 0, frames: false });
    expect(calm.puppets.fling).toBeLessThan(normal.puppets.fling);
    for (const level of [normal, chaos]) {
      expect(level.reach.frames).toBe(true);
      expect(level.reach.anywhere).toBeGreaterThan(0);
    }
    expect(chaos.reach.radius).toBeGreaterThan(normal.reach.radius);
    expect(chaos.reach.max + chaos.reach.anywhere).toBeGreaterThan(
      normal.reach.max + normal.reach.anywhere
    );
    expect(chaos.puppets.fling).toBeGreaterThan(normal.puppets.fling);
  });

  it('pickTargets takes panels and elements anywhere on screen, but never a field being typed in', () => {
    document.body.innerHTML = `
      <div data-xenocat-frame id="panel"><p id="text">Revenue</p></div>
      <button id="near">Pay</button>
      <h2 id="far">Invoices</h2>
      <input id="typing" />`;
    place(document.getElementById('panel')!, 0, 0, 300, 200);
    place(document.getElementById('text')!, 10, 10, 100, 20);
    place(document.getElementById('near')!, 320, 10, 60, 30);
    place(document.getElementById('far')!, 900, 700, 100, 30);
    place(document.getElementById('typing')!, 900, 10, 100, 30);
    (document.getElementById('typing') as HTMLInputElement).focus();
    const ids = (reach: (typeof HIT_LEVELS)['normal']['reach']) =>
      pickTargets(document.body, { x: 150, y: 100 }, reach, createRandom(2))
        .map((element) => element.id)
        .sort();
    // The pointer is on the panel, away from its text: the panel is hit whole.
    expect(ids(HIT_LEVELS.normal.reach)).toEqual(['far', 'near', 'panel']);
    // Calm: no panels and nothing far off; the text inside the panel instead.
    expect(ids(HIT_LEVELS.calm.reach)).toEqual(['text']);
  });
});
