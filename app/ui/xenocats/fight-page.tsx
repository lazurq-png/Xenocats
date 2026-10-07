'use client';

import { useSyncExternalStore } from 'react';
import { XenocatCatsProvider } from './cat-layer';
import { XenocatCursorProvider } from './fake-cursor';
import Fight, { type Kind } from './fight';

const FINE_POINTER = '(pointer: fine)';

/** Whether the device has a precise pointer (a mouse): the fake cursor's own test. */
function subscribePointer(onChange: () => void) {
  if (typeof window.matchMedia !== 'function') return () => {};
  const query = window.matchMedia(FINE_POINTER);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

const hasFinePointer = () =>
  typeof window.matchMedia !== 'function' || window.matchMedia(FINE_POINTER).matches;

/**
 * A fight game's page (/cats/survival, /cats/taming): the game itself, with the
 * cats and the fake cursor it plays with. No cat comes on its own here. On a touch
 * screen (no precise pointer) the page says the game needs a keyboard and mouse.
 */
export default function FightPage({ kind }: { kind: Kind }) {
  // The server cannot know: it renders the game, and a touch screen swaps it out.
  const fine = useSyncExternalStore(subscribePointer, hasFinePointer, () => true);
  if (!fine) {
    return (
      <div>
        <h1 className="font-display text-4xl font-semibold text-cream md:text-[52px]">
          {kind === 'survival' ? 'Survival' : 'Taming'}
        </h1>
        <p data-testid="fight-needs-keyboard" className="mt-4 max-w-2xl text-lg text-white">
          This game needs a keyboard and mouse, for now. Come back on a computer to play it.
        </p>
      </div>
    );
  }
  return (
    <XenocatCursorProvider>
      <XenocatCatsProvider autoSpawn={false}>
        <Fight kind={kind} />
      </XenocatCatsProvider>
    </XenocatCursorProvider>
  );
}
