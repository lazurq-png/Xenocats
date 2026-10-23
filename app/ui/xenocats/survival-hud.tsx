'use client';

import { useSyncExternalStore } from 'react';
import { Button } from '@/app/ui/button';
import { ARENA_CONFIG } from './arena';
import { ENDLESS, type RunLength, clockText } from './arena-storage';
import { VARIETIES } from './varieties';

// Survival's HUD, apart from the arena view: the run's numbers live in a small store
// the view's frame loop writes to, and only these components (and the play area's
// data- attributes, written straight onto it) follow it. So an update renders the
// HUD alone, not the whole arena view around it (night run 2026-10-17, E11).

export type Hud = {
  time: number;
  resolve: number;
  maxResolve: number;
  sentHome: number;
  cats: number;
  heroX: number;
  heroY: number;
  effect: string | null;
  /** The Mega Cat on the field, if one is: how homesick, of how much. */
  boss: { homesickness: number; limit: number } | null;
  level: number;
  xp: number;
  xpToNext: number;
  weapons: string;
  /** The frame time, ms (smoothed), for `?fps=1`. */
  frameMs: number;
  /** How many elites are winding up an attack, and how many have begun in the run. */
  windUps: number;
  windUpsBegun: number;
  bossWindUp: string;
  bossWindUpsBegun: number;
  pickups: number;
  pickupsTaken: number;
  lastPickup: string;
  /** Where the crosshair is on the screen ("x,y"), or "" without one. */
  crosshair: string;
  /** The camera's zoom: arena px to a screen px (1 on a desktop, more on a phone). */
  zoom: number;
  /** Each Keeper's Resolve, and whether he is down (co-op: two). */
  heroes: {
    /** Which of the eight directions he faces. */
    facing: string;
    resolve: number;
    maxResolve: number;
    down: boolean;
    backIn: number;
    x: number;
    y: number;
  }[];
};

export type HudStore = {
  get: () => Hud | null;
  set: (next: Hud | null | ((before: Hud | null) => Hud | null)) => void;
  subscribe: (listener: () => void) => () => void;
};

export function createHudStore(): HudStore {
  let hud: Hud | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => hud,
    set(next) {
      hud = typeof next === 'function' ? next(hud) : next;
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

const useHud = (store: HudStore) => useSyncExternalStore(store.subscribe, store.get, () => null);

/** The play area's data- attributes for a HUD (or none yet): what the browser tests read. */
export function hudData(hud: Hud | null): Record<string, string> {
  const values: Record<string, string | number> = {
    'data-time': hud?.time ?? 0,
    'data-resolve': hud?.resolve ?? ARENA_CONFIG.hero.resolve,
    'data-cats': hud?.cats ?? 0,
    'data-windups': hud?.windUps ?? 0,
    'data-windups-begun': hud?.windUpsBegun ?? 0,
    'data-boss-windup': hud?.bossWindUp ?? '',
    'data-boss-windups-begun': hud?.bossWindUpsBegun ?? 0,
    'data-pickups': hud?.pickups ?? 0,
    'data-pickups-taken': hud?.pickupsTaken ?? 0,
    'data-last-pickup': hud?.lastPickup ?? '',
    'data-sent-home': hud?.sentHome ?? 0,
    'data-hero-facing': hud?.heroes[0]?.facing ?? '',
    'data-hero2-facing': hud?.heroes[1]?.facing ?? '',
    'data-hero-x': hud?.heroX ?? 0,
    'data-hero-y': hud?.heroY ?? 0,
    'data-effect': hud?.effect ?? '',
    'data-level': hud?.level ?? 1,
    'data-boss': hud?.boss ? Math.round(hud.boss.homesickness) : '',
    'data-weapons': hud?.weapons ?? 'laser-pointer:1',
    'data-hero2-x': hud?.heroes[1]?.x ?? '',
    'data-hero2-y': hud?.heroes[1]?.y ?? '',
    'data-down': hud?.heroes.map((h) => (h.down ? 1 : 0)).join(' ') ?? '',
    'data-crosshair': hud?.crosshair ?? '',
    'data-zoom': hud?.zoom ?? '',
  };
  return Object.fromEntries(Object.entries(values).map(([name, value]) => [name, String(value)]));
}

/** The Mega Cat's bar, while one is on the field. */
export function BossBar({ store }: { store: HudStore }) {
  const hud = useHud(store);
  if (!hud?.boss) return null;
  return (
    <div
      data-testid="survival-boss"
      className="mx-auto flex w-full max-w-md flex-col items-center gap-1 px-4 text-sm font-semibold text-cream"
    >
      <span id="boss-label">{VARIETIES.mega.name}</span>
      <div
        role="meter"
        aria-labelledby="boss-label"
        aria-valuemin={0}
        aria-valuemax={Math.round(hud.boss.limit)}
        aria-valuenow={Math.round(hud.boss.homesickness)}
        aria-valuetext={`Homesickness ${Math.round((100 * hud.boss.homesickness) / hud.boss.limit)}%`}
        className="h-3 w-full overflow-hidden rounded-full border border-line bg-panel"
      >
        <div
          className="h-full bg-aura"
          style={{
            width: `${(100 * Math.min(hud.boss.homesickness, hud.boss.limit)) / hud.boss.limit}%`,
          }}
        />
      </div>
    </div>
  );
}

/**
 * The bar along the top: time, Resolve, cats sent home and level, wrapping into rows
 * on a narrow screen, and Pause beside them, always on the first row.
 */
export function HudBar({
  store,
  showFps,
  runLength,
  runPlayers,
  playing,
  onPause,
}: {
  store: HudStore;
  showFps: boolean;
  runLength: RunLength;
  runPlayers: number;
  playing: boolean;
  onPause: () => void;
}) {
  const hud = useHud(store);
  return (
    <div className="flex items-center gap-3 p-3 text-sm font-semibold text-cream sm:p-4">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 sm:gap-x-6">
        {showFps && (
          <p data-testid="survival-fps" data-frame-ms={hud?.frameMs ?? ''}>
            {hud?.frameMs ?? 0} ms · {hud?.cats ?? 0} cats
          </p>
        )}
        <p data-testid="survival-time">
          Time {clockText(hud?.time ?? 0)}
          {runLength === ENDLESS ? ' (endless)' : ` / ${clockText(runLength * 60_000)}`}
        </p>
        <div className="flex items-center gap-2">
          <span id="resolve-label">{runPlayers === 2 ? 'Player 1 Resolve' : 'Resolve'}</span>
          <div
            role="meter"
            aria-labelledby="resolve-label"
            aria-valuemin={0}
            aria-valuemax={hud?.maxResolve ?? ARENA_CONFIG.hero.resolve}
            aria-valuenow={hud?.resolve ?? ARENA_CONFIG.hero.resolve}
            className="h-2 w-20 overflow-hidden rounded-full bg-panel sm:w-32"
          >
            <div
              className="h-full bg-plasma"
              style={{
                width: `${(100 * (hud?.resolve ?? 1)) / (hud?.maxResolve ?? 1)}%`,
              }}
            />
          </div>
          <span data-testid="survival-resolve">
            {hud?.heroes[0]?.down
              ? `Down, back in ${Math.ceil(hud.heroes[0].backIn / 1000)} s`
              : Math.ceil(hud?.resolve ?? 100)}
          </span>
        </div>
        {hud && hud.heroes.length > 1 && (
          <div className="flex items-center gap-2">
            <span id="resolve2-label">Player 2 Resolve</span>
            <div
              role="meter"
              aria-labelledby="resolve2-label"
              aria-valuemin={0}
              aria-valuemax={hud.heroes[1].maxResolve}
              aria-valuenow={hud.heroes[1].resolve}
              className="h-2 w-20 overflow-hidden rounded-full bg-panel sm:w-32"
            >
              <div
                className="h-full bg-aura"
                style={{
                  width: `${(100 * hud.heroes[1].resolve) / hud.heroes[1].maxResolve}%`,
                }}
              />
            </div>
            <span data-testid="survival-resolve2">
              {hud.heroes[1].down
                ? `Down, back in ${Math.ceil(hud.heroes[1].backIn / 1000)} s`
                : Math.ceil(hud.heroes[1].resolve)}
            </span>
          </div>
        )}
        <p data-testid="survival-sent-home">Cats sent home: {hud?.sentHome ?? 0}</p>
        <div className="flex items-center gap-2">
          <span data-testid="survival-level">Level {hud?.level ?? 1}</span>
          <div
            role="progressbar"
            aria-label="Experience"
            aria-valuemin={0}
            aria-valuemax={hud?.xpToNext ?? 5}
            aria-valuenow={hud?.xp ?? 0}
            className="h-2 w-16 overflow-hidden rounded-full bg-panel sm:w-24"
          >
            <div
              className="h-full bg-aura"
              style={{ width: `${(100 * (hud?.xp ?? 0)) / (hud?.xpToNext ?? 5)}%` }}
            />
          </div>
        </div>
      </div>
      {playing && (
        <Button className="pointer-events-auto h-11 shrink-0" onClick={onPause}>
          Pause
        </Button>
      )}
    </div>
  );
}
