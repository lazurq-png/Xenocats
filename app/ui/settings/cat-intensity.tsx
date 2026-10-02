'use client';

import { useSyncExternalStore } from 'react';
import clsx from 'clsx';
import {
  INTENSITIES,
  INTENSITY_LABELS,
  type Intensity,
  getIntensity,
  setIntensity,
  subscribeIntensity,
} from '@/app/ui/xenocats/intensity';

const DESCRIPTIONS: Record<Intensity, string> = {
  calm: 'Now and then, at most two at once.',
  normal: 'The cats as they have always been.',
  chaos: 'Often, and up to five at once.',
};

/** Calm, normal or chaos: how hard the cats haunt the dashboard. Saved in this browser. */
export default function CatIntensity() {
  const current = useSyncExternalStore(subscribeIntensity, getIntensity, () => 'normal' as const);
  return (
    <fieldset className="rounded-2xl border border-line bg-panel p-4 md:p-6">
      <legend className="sr-only">Cat intensity</legend>
      <div className="grid gap-3 sm:grid-cols-3">
        {INTENSITIES.map((level) => (
          <label
            key={level}
            className={clsx(
              'flex cursor-pointer flex-col gap-1 rounded-xl border p-3 text-sm',
              level === current ? 'border-plasma bg-void/70' : 'border-line hover:border-aura'
            )}
          >
            <span className="flex items-center gap-2 font-semibold text-white">
              <input
                type="radio"
                name="cat-intensity"
                value={level}
                checked={level === current}
                onChange={() => setIntensity(level)}
                className="h-4 w-4 border-line bg-void text-plasma focus:ring-2 focus:ring-plasma focus:ring-offset-panel"
              />
              {INTENSITY_LABELS[level]}
            </span>
            <span className="text-aura">{DESCRIPTIONS[level]}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
