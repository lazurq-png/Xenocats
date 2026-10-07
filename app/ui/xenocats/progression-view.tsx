'use client';

// Survival's start screen, below Start: the tufts he has, the character he goes
// out as, the Tailor's wares, and the codex. Everything here reads and writes the
// stored progress (progression.ts); the run itself reads it when it starts.

import { useSyncExternalStore } from 'react';
import { Button } from '@/app/ui/button';
import {
  CHARACTERS,
  type CharacterId,
  MILESTONES,
  UPGRADES,
  type UpgradeId,
  buyCharacter,
  buyUpgrade,
  chooseCharacter,
  codexEntries,
  hasCharacter,
  readProgress,
  serverProgress,
  subscribeProgress,
  upgradeCost,
  writeProgress,
} from './progression';

export function useProgress() {
  return useSyncExternalStore(subscribeProgress, readProgress, serverProgress);
}

export function ProgressionPanel() {
  const progress = useProgress();

  return (
    <div className="mt-6 grid max-w-4xl gap-6 md:grid-cols-2">
      <section
        aria-labelledby="characters-heading"
        className="rounded-2xl border border-line bg-panel p-5"
      >
        <h2 id="characters-heading" className="font-display text-xl font-semibold text-cream">
          Who goes out tonight
        </h2>
        <p
          data-testid="survival-tufts"
          data-tufts={progress.tufts}
          className="mt-1 text-sm text-plasma"
        >
          Tufts of fur: {progress.tufts}
        </p>
        <fieldset className="mt-3">
          <legend className="sr-only">Character</legend>
          <ul className="space-y-2">
            {(Object.keys(CHARACTERS) as CharacterId[]).map((id) => {
              const character = CHARACTERS[id];
              const had = hasCharacter(progress, id);
              const unlock = character.unlock;
              return (
                <li key={id} className="text-sm">
                  <label className="flex items-start gap-2">
                    <input
                      type="radio"
                      name="survival-character"
                      value={id}
                      data-testid={`survival-character-${id}`}
                      checked={progress.character === id}
                      disabled={!had}
                      onChange={() => writeProgress(chooseCharacter(readProgress(), id))}
                      className="mt-1 border-line bg-void text-aura focus:ring-aura"
                    />
                    <span>
                      <span className="font-semibold text-cream">{character.name}</span>
                      <span className="block text-aura">{character.description}</span>
                      {!had && unlock.kind === 'milestone' && (
                        <span className="block text-white">
                          Locked: {MILESTONES[unlock.milestone].text}.
                        </span>
                      )}
                    </span>
                  </label>
                  {unlock.kind === 'cost' && (
                    <Button
                      className="ml-6 mt-1"
                      data-testid={`survival-buy-${id}`}
                      aria-disabled={had || progress.tufts < unlock.cost}
                      onClick={() => {
                        const next = buyCharacter(readProgress(), id);
                        if (next) writeProgress(next);
                      }}
                    >
                      {had ? 'Engaged' : `Engage for ${unlock.cost} tufts`}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </fieldset>
      </section>

      <section
        aria-labelledby="tailor-heading"
        className="rounded-2xl border border-line bg-panel p-5"
      >
        <h2 id="tailor-heading" className="font-display text-xl font-semibold text-cream">
          The Tailor
        </h2>
        <p className="mt-1 text-sm text-aura">He alters the coat. Permanently, and for tufts.</p>
        <ul className="mt-3 space-y-3">
          {(Object.keys(UPGRADES) as UpgradeId[]).map((id) => {
            const upgrade = UPGRADES[id];
            const level = progress.upgrades[id] ?? 0;
            const cost = upgradeCost(id, level);
            return (
              <li
                key={id}
                data-testid={`survival-upgrade-${id}`}
                data-level={level}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <span>
                  <span className="font-semibold text-cream">
                    {upgrade.name} {level}/{upgrade.maxLevel}
                  </span>
                  <span className="block text-aura">{upgrade.description}</span>
                </span>
                <Button
                  data-testid={`survival-buy-${id}`}
                  aria-disabled={cost === null || progress.tufts < cost}
                  aria-label={
                    cost === null
                      ? `${upgrade.name}: complete`
                      : `Buy ${upgrade.name} level ${level + 1} for ${cost} tufts`
                  }
                  onClick={() => {
                    const next = buyUpgrade(readProgress(), id);
                    if (next) writeProgress(next);
                  }}
                >
                  {cost === null ? 'Complete' : `${cost} tufts`}
                </Button>
              </li>
            );
          })}
        </ul>
      </section>

      <section
        aria-labelledby="codex-heading"
        className="rounded-2xl border border-line bg-panel p-5 md:col-span-2"
      >
        <h2 id="codex-heading" className="font-display text-xl font-semibold text-cream">
          Codex
        </h2>
        <p className="mt-1 text-sm text-aura">What the nights have shown him.</p>
        <ul data-testid="survival-codex" className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          {codexEntries(progress).map((entry) => (
            <li
              key={entry.id}
              data-found={entry.found}
              className={entry.found ? 'text-cream' : 'text-white/60'}
            >
              {entry.name}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
