// Survival's arena view (arena-view.tsx): its constants (colours, sizes, timings),
// the words for a run's length and outcome, and the small helpers outside the
// component. Split out of arena-view.tsx, which imports them (a 'use client' module
// cannot re-export with `export *`).

import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { ArenaOutcome } from './arena';
import { directionOfAngle } from './hero-direction';
import { ENDLESS, type RunLength, readCharacterBest } from './arena-storage';
import { CAT_TYPES } from './cat-types';
import { CHARACTERS, type CharacterId } from './progression';

export type Screen = 'start' | 'playing' | 'choosing' | 'paused' | 'results';

/** How each weapon's shots are drawn. */
export const SHOT_COLOR: Record<string, string> = {
  'cat-treats': '#fbbf24',
  banquet: '#fbbf24',
  'spray-bottle': '#7dd3fc',
  monsoon: '#38bdf8',
  'yarn-ball': '#f472b6',
  'yarn-apocalypse': '#ec4899',
  hairball: '#a8865b',
  'lucky-furball': '#e0b45c',
  'bottomless-saucer': '#f5f0e0',
  'bath-tub': '#7dd3fc',
  jacuzzi: '#38bdf8',
  'tennis-ball': '#d9f99d',
  'serve-machine': '#bef264',
  cucumber: '#86efac',
  'pickle-jar': '#4ade80',
};

/** How each weapon's zone is drawn (r, g, b); the Thunderous Vacuum's is the default. */
export const ZONE_COLOR: Record<string, string> = {
  'alarm-clock': '251, 191, 36',
  'grandfather-clock': '217, 119, 6',
  'roaring-upright': '125, 211, 252',
};

/** How long an evolution's announcement stays, ms. */
export const NOTICE_MS = 5000;

/**
 * How often the HUD is updated during a run, ms. Once this rendered the whole view, and
 * E10 slowed it to 250 ms for speed; since E11 it renders the HUD alone (survival-hud.tsx),
 * and 150 ms costs a slow machine only 2–3% against 250 (night run 2026-10-17).
 */
export const HUD_EVERY_MS = 150;

/** Cats drawn this size, px. */
export const CAT_SIZE = 44;
export const HERO_SIZE = 56;
/** A game step more than this behind is dropped: the game slows rather than freezing. */
export const MAX_STEPS_PER_FRAME = 240;
/** Never more than this many sounds start within `SOUND_WINDOW_MS`. */
export const MAX_SOUNDS = 3;
export const SOUND_WINDOW_MS = 300;

export const FRAME_GUARD = { floorFps: 40, resumeFps: 50, smoothing: 0.1 };

export type Flash = { x: number; y: number; until: number };

/** A run that reached its goal, by its length (an endless run has none to reach). */
export const LENGTH_WORDS: Record<Exclude<RunLength, typeof ENDLESS>, string> = {
  5: 'Five',
  10: 'Ten',
  15: 'Fifteen',
};

export const OUTCOME_TEXT: Record<ArenaOutcome, string> = {
  spent: 'His Resolve is spent. The cats remain.',
  'gave-up': 'He has given up. The cats remain.',
  goal: 'The night is survived. The cats remain.',
};

/** A sound for a cat of any kind: a variety sounds like the first xenocat type. */
export const typeOf = (type: number) => CAT_TYPES[type] ?? CAT_TYPES[0];

/** The direction a Keeper is drawn facing: his aim; a downed one lies on his side, as ever. */
export const viewDirection = (h: { down: boolean; facing: number; lookAngle: number }) =>
  h.down ? (h.facing < 0 ? 'W' : 'E') : directionOfAngle(h.lookAngle);

/** A bitmap of `src`, `size` px square, drawn once; null until it has loaded. */
export function bitmapOf(
  src: string,
  size: number,
  onReady: () => void
): () => HTMLCanvasElement | null {
  let ready: HTMLCanvasElement | null = null;
  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    canvas.getContext('2d')?.drawImage(image, 0, 0, size, size);
    ready = canvas;
    onReady();
  };
  image.src = src;
  return () => ready;
}

/**
 * Each character's best for a run length, as one string (a snapshot that stays the same
 * while nothing changes): "ms@date" per character, in CHARACTERS order, "" for none.
 */
export const characterBestsOf = (length: RunLength) =>
  (Object.keys(CHARACTERS) as CharacterId[])
    .map((id) => {
      const best = readCharacterBest(length, id);
      return best ? `${best.ms}@${best.date}` : '';
    })
    .join('|');

/** A boss sent home: the run slows to this share of its pace for `BOSS_SLOW_MS`. */
export const BOSS_SLOW = 0.3;
export const BOSS_SLOW_MS = 1400;
/** The screen shakes this long, this far at first (px). */
export const BOSS_SHAKE_MS = 700;
export const BOSS_SHAKE = 9;
/** The mothership's visit: down, the beam lifts the boss, away. */
export const MOTHERSHIP_MS = 2200;
/** Each gem size (gemSize): its colour, and half its height, px. */
export const GEM_COLOUR = ['#9d86ff', '#7dd3fc', '#c1e838', '#fbbf24'] as const;
export const GEM_HEIGHT = [6, 7.5, 9, 11] as const;

/** Keeps Tab and Shift+Tab inside a modal <dialog>, as the start screen's windows do. */
export function trapTab(event: ReactKeyboardEvent<HTMLDialogElement>) {
  if (event.key !== 'Tab') return;
  const focusable = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled])'
    )
  );
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

export function subscribeBest(onChange: () => void) {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
}
