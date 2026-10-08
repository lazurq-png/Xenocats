'use client';

import { useSyncExternalStore } from 'react';
import ArenaGame from './arena-view';

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
 * The game's page, /cats/survival: the arena (arena-view.tsx). It needs neither the
 * page's cats nor its fake cursor, so neither runs there. On a touch screen (no
 * precise pointer) it is walked with the movement pad.
 */
export default function FightPage() {
  // The server cannot know: it renders the desktop game, and a touch screen swaps it.
  const fine = useSyncExternalStore(subscribePointer, hasFinePointer, () => true);
  return <ArenaGame touch={!fine} />;
}
