'use client';

import { useSyncExternalStore } from 'react';
import { type AimMode, readAim, subscribeAim, writeAim } from './arena-storage';
import { getSoundEnabled, setSoundEnabled, sharedSoundPlayer, subscribeSound } from './sounds';

/**
 * Survival's settings, in its lobby and its pause menu alike. Sound is the site's
 * one setting (sounds.ts): switched here, the cats on the dashboard and on /cats
 * are silent too, and the speaker in their corner shows it. Aim is Survival's own,
 * and only on a computer: a touch screen has no pointer to aim with.
 */
export function GameSettings({ where, touch }: { where: 'lobby' | 'pause'; touch: boolean }) {
  const sound = useSyncExternalStore(subscribeSound, getSoundEnabled, () => true);
  const aim = useSyncExternalStore(subscribeAim, readAim, (): AimMode => 'auto');
  return (
    <fieldset
      data-testid={`survival-${where}-settings`}
      className="mt-4 text-left text-sm text-aura"
    >
      <legend className="font-semibold text-cream">Settings</legend>
      <label className="mt-1 flex items-center gap-2">
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
          className="rounded border-line bg-void text-aura focus:ring-aura"
        />
        Sound
      </label>
      {!touch && (
        <fieldset className="mt-2">
          <legend className="text-cream">Aim</legend>
          <div className="mt-1 flex flex-wrap gap-4">
            {(
              [
                ['auto', 'Automatic: his weapons find the cats'],
                ['crosshair', 'Crosshair: they fire where the mouse points'],
              ] as const
            ).map(([mode, label]) => (
              <label key={mode} className="flex items-center gap-2">
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
