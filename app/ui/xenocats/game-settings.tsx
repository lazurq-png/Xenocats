'use client';

import { useSyncExternalStore } from 'react';
import { getSoundEnabled, setSoundEnabled, sharedSoundPlayer, subscribeSound } from './sounds';

/**
 * Survival's settings, in its lobby and its pause menu alike. Sound is the site's
 * one setting (sounds.ts): switched here, the cats on the dashboard and on /cats
 * are silent too, and the speaker in their corner shows it.
 */
export function GameSettings({ where }: { where: 'lobby' | 'pause' }) {
  const sound = useSyncExternalStore(subscribeSound, getSoundEnabled, () => true);
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
    </fieldset>
  );
}
