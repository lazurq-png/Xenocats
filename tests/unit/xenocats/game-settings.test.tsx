// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  SURVIVAL_AIM_KEY,
  SURVIVAL_BEST_KEY,
  bestKey,
  characterBestKey,
  dayOf,
  dayText,
  parseAim,
  parseCharacterBest,
  readAim,
  readBest,
  readCharacterBest,
  recordCharacterRun,
  writeAim,
  writeBest,
} from '@/app/ui/xenocats/arena-storage';
import { GameSettings } from '@/app/ui/xenocats/game-settings';
import { type Hud, HudBar, createHudStore, hudData } from '@/app/ui/xenocats/survival-hud';
import { act } from 'react';
import { SOUND_KEY } from '@/app/ui/xenocats/sounds';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('the aim setting, stored', () => {
  it('is automatic unless the crosshair was chosen; anything unreadable is automatic', () => {
    expect(parseAim(null)).toBe('auto');
    expect(parseAim('crosshair')).toBe('crosshair');
    expect(parseAim('auto')).toBe('auto');
    expect(parseAim('CROSSHAIR')).toBe('auto');
    expect(parseAim('{"x":1}')).toBe('auto');
  });

  it('is kept in the browser, under its own key', () => {
    expect(readAim()).toBe('auto');
    writeAim('crosshair');
    expect(localStorage.getItem(SURVIVAL_AIM_KEY)).toBe('crosshair');
    expect(readAim()).toBe('crosshair');
    writeAim('auto');
    expect(readAim()).toBe('auto');
  });
});

describe('Survival’s settings', () => {
  it('a computer gets Sound and Aim; switching them stores the site’s and the game’s settings', () => {
    render(<GameSettings where="lobby" touch={false} />);
    const sound = screen.getByRole('checkbox', { name: 'Sound' });
    expect((sound as HTMLInputElement).checked).toBe(true);
    fireEvent.click(sound);
    expect(localStorage.getItem(SOUND_KEY)).toBe('off');
    expect((screen.getByRole('checkbox', { name: 'Sound' }) as HTMLInputElement).checked).toBe(
      false
    );

    const crosshair = screen.getByRole('radio', { name: /^Crosshair/ });
    expect((screen.getByRole('radio', { name: /^Automatic/ }) as HTMLInputElement).checked).toBe(
      true
    );
    fireEvent.click(crosshair);
    expect(localStorage.getItem(SURVIVAL_AIM_KEY)).toBe('crosshair');
    expect((screen.getByRole('radio', { name: /^Crosshair/ }) as HTMLInputElement).checked).toBe(
      true
    );
  });

  it('a touch screen gets Sound and Graphics but no Aim: it has no pointer to aim with', () => {
    render(<GameSettings where="pause" touch />);
    expect(screen.getByRole('checkbox', { name: 'Sound' })).toBeTruthy();
    expect(screen.getAllByRole('radio').map((r) => r.getAttribute('data-testid'))).toEqual([
      'survival-pause-graphics-full',
      'survival-pause-graphics-light',
    ]);
    expect(screen.queryByTestId('survival-pause-aim-crosshair')).toBeNull();
  });

  it('the lobby and the pause menu show the same setting', () => {
    render(
      <>
        <GameSettings where="lobby" touch={false} />
        <GameSettings where="pause" touch={false} />
      </>
    );
    fireEvent.click(screen.getByTestId('survival-pause-sound'));
    expect((screen.getByTestId('survival-lobby-sound') as HTMLInputElement).checked).toBe(false);
    fireEvent.click(screen.getByTestId('survival-lobby-aim-crosshair'));
    expect((screen.getByTestId('survival-pause-aim-crosshair') as HTMLInputElement).checked).toBe(
      true
    );
  });
});

// Each character's best for each run length, with the day it was set (arena-storage.ts).
const on = (iso: string) => new Date(`${iso}T12:00:00`);

describe('each character’s best', () => {
  it('a key for each length and character, endless named as such, apart from the overall bests', () => {
    const keys = new Set<string>();
    for (const length of [5, 10, 15, 0] as const) {
      for (const id of ['keeper', 'night-porter']) keys.add(characterBestKey(length, id));
    }
    expect(keys.size).toBe(8);
    expect(characterBestKey(0, 'keeper')).toContain(':endless:keeper');
    for (const length of [5, 10, 15, 0] as const) expect(keys.has(bestKey(length))).toBe(false);
  });

  it('reads back what it keeps; anything corrupt reads as none', () => {
    expect(parseCharacterBest(JSON.stringify({ ms: 61_234, date: '2026-10-17' }))).toEqual({
      ms: 61_234,
      date: '2026-10-17',
    });
    for (const raw of [
      null,
      '',
      'abc',
      '61234',
      'null',
      JSON.stringify({ ms: -5, date: '2026-10-17' }),
      JSON.stringify({ ms: 'x', date: '2026-10-17' }),
      JSON.stringify({ ms: 1000, date: '17/10/2026' }),
      JSON.stringify({ ms: 1000, date: '2026-13-40' }),
      JSON.stringify({ ms: 1000, date: '2026-02-30' }),
      JSON.stringify({ ms: 1000 }),
      JSON.stringify({ ms: 48 * 3_600_000, date: '2026-10-17' }),
    ]) {
      expect(parseCharacterBest(raw), String(raw)).toBeNull();
    }
  });

  it('a first run is the best, with its day; a longer one replaces it, a shorter or equal one does not', () => {
    expect(readCharacterBest(5, 'keeper')).toBeNull();
    expect(recordCharacterRun(5, 'keeper', 90_400.6, on('2026-10-15'))).toEqual({
      ms: 90_400,
      date: '2026-10-15',
    });
    expect(recordCharacterRun(5, 'keeper', 80_000, on('2026-10-16'))).toEqual({
      ms: 90_400,
      date: '2026-10-15',
    });
    // A tie keeps the day it was first reached.
    expect(recordCharacterRun(5, 'keeper', 90_400, on('2026-10-16'))?.date).toBe('2026-10-15');
    expect(recordCharacterRun(5, 'keeper', 120_000, on('2026-10-17'))).toEqual({
      ms: 120_000,
      date: '2026-10-17',
    });
    expect(readCharacterBest(5, 'keeper')).toEqual({ ms: 120_000, date: '2026-10-17' });
  });

  it('each length and character keeps its own; an endless best is the longest survived', () => {
    recordCharacterRun(5, 'keeper', 60_000, on('2026-10-17'));
    recordCharacterRun(0, 'keeper', 700_000, on('2026-10-17'));
    recordCharacterRun(0, 'keeper', 400_000, on('2026-10-18'));
    expect(readCharacterBest(0, 'keeper')?.ms).toBe(700_000);
    expect(readCharacterBest(5, 'keeper')?.ms).toBe(60_000);
    expect(readCharacterBest(5, 'night-porter')).toBeNull();
    expect(readCharacterBest(10, 'keeper')).toBeNull();
  });

  it('the overall bests stored before are kept and count as before', () => {
    window.localStorage.setItem(SURVIVAL_BEST_KEY, '150000');
    recordCharacterRun(5, 'keeper', 200_000, on('2026-10-17'));
    expect(window.localStorage.getItem(SURVIVAL_BEST_KEY)).toBe('150000');
    expect(readBest(5)).toBe(150_000);
    writeBest(200_000, 5);
    expect(readBest(5)).toBe(200_000);
  });

  it('a time that is no time is not kept', () => {
    expect(recordCharacterRun(5, 'keeper', 0, on('2026-10-17'))).toBeNull();
    expect(recordCharacterRun(5, 'keeper', Number.NaN, on('2026-10-17'))).toBeNull();
    expect(readCharacterBest(5, 'keeper')).toBeNull();
  });

  it('blocked storage: nothing kept, nothing thrown', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(recordCharacterRun(5, 'keeper', 60_000, on('2026-10-17'))).toBeNull();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readCharacterBest(5, 'keeper')).toBeNull();
  });

  it('the day is the player’s own, and said as the lobby says it', () => {
    expect(dayOf(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(dayText('2026-10-17')).toBe('17 Oct 2026');
    expect(dayText('2026-01-05')).toBe('5 Jan 2026');
  });
});

// Survival's HUD, apart from the arena view: its store, the play area's data-
// attributes, and the bar that follows the store on its own (survival-hud.tsx).
describe('the Survival HUD', () => {
  const hud = (fields: Partial<Hud> = {}): Hud => ({
    time: 61_000,
    resolve: 40,
    maxResolve: 100,
    sentHome: 12,
    cats: 30,
    heroX: 5,
    heroY: -7,
    effect: null,
    boss: null,
    level: 3,
    xp: 2,
    xpToNext: 14,
    weapons: 'laser-pointer:2',
    frameMs: 16.7,
    windUps: 0,
    windUpsBegun: 1,
    bossWindUp: '',
    bossWindUpsBegun: 0,
    pickups: 0,
    pickupsTaken: 0,
    lastPickup: '',
    crosshair: '',
    zoom: 1,
    heroes: [{ facing: 'e', resolve: 40, maxResolve: 100, down: false, backIn: 0, x: 5, y: -7 }],
    ...fields,
  });

  it('the store gives what was set, a value or an update of the last, and tells its listeners', () => {
    const store = createHudStore();
    expect(store.get()).toBeNull();
    const heard = vi.fn();
    const stop = store.subscribe(heard);
    store.set(hud());
    store.set((before) => (before ? { ...before, level: 4 } : before));
    expect(store.get()?.level).toBe(4);
    expect(heard).toHaveBeenCalledTimes(2);
    stop();
    store.set(null);
    expect(heard).toHaveBeenCalledTimes(2);
  });

  it('the play area’s data- attributes: the defaults before a run, then the run’s own', () => {
    // Every name the browser tests read, no more, no fewer.
    expect(Object.keys(hudData(null)).sort()).toEqual(
      [
        'data-boss',
        'data-boss-windup',
        'data-boss-windups-begun',
        'data-cats',
        'data-crosshair',
        'data-down',
        'data-effect',
        'data-hero-facing',
        'data-hero-x',
        'data-hero-y',
        'data-hero2-facing',
        'data-hero2-x',
        'data-hero2-y',
        'data-last-pickup',
        'data-level',
        'data-pickups',
        'data-pickups-taken',
        'data-resolve',
        'data-sent-home',
        'data-time',
        'data-weapons',
        'data-windups',
        'data-windups-begun',
        'data-zoom',
      ].sort()
    );
    expect(hudData(null)).toMatchObject({
      'data-time': '0',
      'data-resolve': '100',
      'data-level': '1',
      'data-weapons': 'laser-pointer:1',
      'data-boss': '',
    });
    expect(hudData(hud({ boss: { homesickness: 12.6, limit: 900 } }))).toMatchObject({
      'data-time': '61000',
      'data-sent-home': '12',
      'data-level': '3',
      'data-hero-facing': 'e',
      'data-down': '0',
      'data-boss': '13',
    });
  });

  it('the bar follows the store by itself: no parent renders it again', () => {
    const store = createHudStore();
    let parentRenders = 0;
    function Parent() {
      parentRenders++;
      return (
        <HudBar
          store={store}
          showFps={false}
          runLength={5}
          runPlayers={1}
          playing
          onPause={() => {}}
        />
      );
    }
    render(<Parent />);
    expect(screen.getByTestId('survival-time').textContent).toBe('Time 0:00 / 5:00');
    act(() => store.set(hud()));
    expect(screen.getByTestId('survival-time').textContent).toBe('Time 1:01 / 5:00');
    expect(screen.getByTestId('survival-sent-home').textContent).toBe('Cats sent home: 12');
    expect(screen.getByTestId('survival-level').textContent).toBe('Level 3');
    expect(parentRenders).toBe(1);
  });
});
