'use client';

import { useSyncExternalStore } from 'react';
import {
  type AimMode,
  type MusicChoice,
  readAim,
  readGraphics,
  readMusic,
  subscribeAim,
  subscribeGraphics,
  subscribeMusic,
  writeAim,
  writeGraphics,
  writeMusic,
} from './arena-storage';
import type { Graphics } from './graphics';
import { getSoundEnabled, setSoundEnabled, sharedSoundPlayer, subscribeSound } from './sounds';

/**
 * Survival's settings, in its lobby and its pause menu alike. Sound is the site's
 * one setting (sounds.ts): switched here, the cats on the dashboard and on /cats
 * are silent too, and the speaker in their corner shows it. Music (music.ts, the
 * game chooses the tunes), aim and graphics are Survival's own; music plays only
 * with sound on. Aim is offered
 * only on a computer: a touch screen has no pointer to aim with.
 */
export function GameSettings({ where, touch }: { where: 'lobby' | 'pause'; touch: boolean }) {
  const sound = useSyncExternalStore(subscribeSound, getSoundEnabled, () => true);
  const aim = useSyncExternalStore(subscribeAim, readAim, (): AimMode => 'auto');
  const graphics = useSyncExternalStore(subscribeGraphics, readGraphics, (): Graphics => 'full');
  const music = useSyncExternalStore(subscribeMusic, readMusic, (): MusicChoice => 'on');
  return (
    <fieldset
      data-testid={`survival-${where}-settings`}
      className="mt-4 text-left text-sm text-aura"
    >
      <legend className="font-semibold text-cream">Settings</legend>
      <label className="mt-1 flex min-h-11 items-center gap-2">
        <input
          type="checkbox"
          data-testid={`survival-${where}-sound`}
          checked={sound}
          onChange={(event) => {
            setSoundEnabled(event.target.checked);
            // Switched on mid-run: this click or tap is the gesture some browsers
            // need before sound can start (the run's own Start found it off).
            if (event.target.checked) sharedSoundPlayer().unlock();
          }}
          className="rounded-sm border-line bg-void text-aura focus:ring-aura"
        />
        Sound
      </label>
      <div className="flex flex-wrap items-center gap-x-2">
        <label className="flex min-h-11 items-center gap-2">
          <input
            type="checkbox"
            data-testid={`survival-${where}-music`}
            checked={music === 'on'}
            aria-describedby={sound ? undefined : `survival-${where}-music-note`}
            onChange={(event) => writeMusic(event.target.checked ? 'on' : 'off')}
            className="rounded-sm border-line bg-void text-aura focus:ring-aura"
          />
          Music
        </label>
        {!sound && (
          <span id={`survival-${where}-music-note`} className="text-xs">
            (heard when Sound is on)
          </span>
        )}
      </div>
      <fieldset className="mt-2">
        <legend className="text-cream">Graphics</legend>
        <div className="mt-1 flex flex-wrap gap-x-4">
          {(
            [
              ['full', 'Full'],
              ['light', 'Light: no glows, for a slow screen'],
            ] as const
          ).map(([mode, label]) => (
            <label key={mode} className="flex min-h-11 items-center gap-2">
              <input
                type="radio"
                name={`survival-${where}-graphics`}
                data-testid={`survival-${where}-graphics-${mode}`}
                checked={graphics === mode}
                onChange={() => writeGraphics(mode)}
                className="border-line bg-void text-aura focus:ring-aura"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      {!touch && (
        <fieldset className="mt-2">
          <legend className="text-cream">Aim</legend>
          <div className="mt-1 flex flex-wrap gap-x-4">
            {(
              [
                ['auto', 'Automatic: his weapons find the cats'],
                ['crosshair', 'Crosshair: they fire where the mouse points'],
              ] as const
            ).map(([mode, label]) => (
              <label key={mode} className="flex min-h-11 items-center gap-2">
                <input
                  type="radio"
                  name={`survival-${where}-aim`}
                  data-testid={`survival-${where}-aim-${mode}`}
                  checked={aim === mode}
                  onChange={() => writeAim(mode)}
                  className="border-line bg-void text-aura focus:ring-aura"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      )}
    </fieldset>
  );
}
