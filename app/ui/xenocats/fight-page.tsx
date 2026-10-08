'use client';

import { useSyncExternalStore } from 'react';
import ArenaGame from './arena-view';
import { XenocatCatsProvider } from './cat-layer';
import { XenocatCursorProvider } from './fake-cursor';
import Fight from './fight';

export type Kind = 'survival' | 'taming';

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
 * A fight game's page. Survival (/cats/survival) is the arena (arena-view.tsx): it
 * needs neither the page's cats nor its fake cursor, so neither runs there. Taming
 * (/cats/taming) plays with both, with no cat coming on its own. On a touch screen
 * (no precise pointer) either game is walked with the movement pad.
 */
export default function FightPage({ kind }: { kind: Kind }) {
  // The server cannot know: it renders the desktop game, and a touch screen swaps it.
  const fine = useSyncExternalStore(subscribePointer, hasFinePointer, () => true);
  if (kind === 'survival') return <ArenaGame touch={!fine} />;
  return (
    <XenocatCursorProvider>
      <XenocatCatsProvider autoSpawn={false}>
        <Fight touch={!fine} />
      </XenocatCatsProvider>
    </XenocatCursorProvider>
  );
}
