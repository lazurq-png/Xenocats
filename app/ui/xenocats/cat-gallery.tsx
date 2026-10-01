'use client';

import { useState } from 'react';
import { Button } from '@/app/ui/button';
import { XenocatCatsProvider, useXenocats } from './cat-layer';
import { catArt } from './cat-art';
import { CatSprite } from './cat-sprite';
import { CAT_TYPES, type CatType } from './cat-types';
import { XenocatCursorProvider } from './fake-cursor';

/**
 * Every cat type with two Summon buttons: awake, to pounce as soon as it arrives,
 * or asleep, to nap and wake first as the dashboard's cats do (and show both poses'
 * artwork). Cats only come when summoned here, so the page is calm to browse and
 * predictable to test.
 */
export default function CatGallery() {
  return (
    <XenocatCursorProvider>
      <XenocatCatsProvider autoSpawn={false}>
        <Roster />
      </XenocatCatsProvider>
    </XenocatCursorProvider>
  );
}

function Roster() {
  const cats = useXenocats();
  const [status, setStatus] = useState('');

  const summon = (type: CatType, asleep: boolean) => {
    // Refused when five cats are already here, or when there is no free spot.
    const message = cats.summon(type.id, { asleep })
      ? asleep
        ? `${type.name} is on its way, and will nap before it pounces.`
        : `${type.name} is on its way.`
      : 'No room for another cat right now. Wait for one to leave.';
    // Clear first, so a screen reader announces the same message again.
    setStatus('');
    requestAnimationFrame(() => setStatus(message));
  };

  return (
    <>
      <p role="status" aria-live="polite" className="mb-4 min-h-5 text-sm text-aura">
        {status}
      </p>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {CAT_TYPES.map((type) => (
          <li
            key={type.id}
            data-testid={`cat-card-${type.id}`}
            className="flex flex-col rounded-2xl border border-line bg-panel p-4 transition-colors hover:border-aura/60"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 flex-none items-center justify-center rounded-xl bg-void/70">
                <CatSprite
                  palette={type.palette}
                  look={type.look}
                  pose="awake"
                  size={64}
                  art={catArt(type.id, 'awake')}
                />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-aura">
                  No. {type.number}
                </p>
                <h2 className="text-lg font-semibold text-white">{type.name}</h2>
                <p className="text-sm font-medium text-plasma">{type.effect.name}</p>
              </div>
            </div>
            <p className="mt-3 grow text-sm text-aura">{type.effect.description}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button
                className="justify-center whitespace-nowrap px-1 text-[13px]"
                data-testid={`summon-${type.id}`}
                aria-label={`Summon ${type.name} awake`}
                onClick={() => summon(type, false)}
              >
                Summon awake
              </Button>
              <Button
                className="justify-center whitespace-nowrap px-1 text-[13px]"
                data-testid={`summon-asleep-${type.id}`}
                aria-label={`Summon ${type.name} asleep`}
                onClick={() => summon(type, true)}
              >
                Summon asleep
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
