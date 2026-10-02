'use client';

import { memo, useCallback, useState, useSyncExternalStore } from 'react';
import { Button } from '@/app/ui/button';
import { XenocatCatsProvider, useXenocats } from './cat-layer';
import { catArt } from './cat-art';
import { CatSprite } from './cat-sprite';
import { CAT_TYPES, type CatType } from './cat-types';
import { XenocatCursorProvider } from './fake-cursor';
import Fight from './fight';
import { entryFor, getGuide, getServerGuide, isEmptyGuide, subscribeGuide } from './field-guide';

/**
 * Every cat type with two Summon buttons: awake, to pounce as soon as it arrives,
 * or asleep, to nap and wake first as the dashboard's cats do (and show both poses'
 * artwork). Cats only come when summoned here, so the page is calm to browse and
 * predictable to test. Above them, Fight a cat; no cat can be summoned during a game.
 */
export default function CatGallery() {
  const [fighting, setFighting] = useState(false);
  return (
    <XenocatCursorProvider>
      <XenocatCatsProvider autoSpawn={false}>
        <Fight onPlayingChange={setFighting} />
        <Roster disabled={fighting} />
      </XenocatCatsProvider>
    </XenocatCursorProvider>
  );
}

function Roster({ disabled }: { disabled: boolean }) {
  const cats = useXenocats();
  const [status, setStatus] = useState('');

  const summon = useCallback(
    (type: CatType, asleep: boolean) => {
      // Refused when five cats are already here, or when there is no free spot.
      const message = cats.summon(type.id, { asleep })
        ? asleep
          ? `${type.name} is on its way, and will nap before it pounces.`
          : `${type.name} is on its way.`
        : 'No room for another cat right now. Wait for one to leave.';
      // Clear first, so a screen reader announces the same message again.
      setStatus('');
      requestAnimationFrame(() => setStatus(message));
    },
    [cats]
  );

  const guide = useSyncExternalStore(subscribeGuide, getGuide, getServerGuide);
  // A tamed cat was met, even if it was tamed before the guide counted meetings.
  const metCount = CAT_TYPES.filter((type) => {
    const entry = entryFor(guide, type.id);
    return entry.met > 0 || entry.tamed > 0;
  }).length;

  return (
    <>
      <section aria-labelledby="guide-heading" className="mb-4">
        <h2 id="guide-heading" className="font-display text-2xl font-semibold text-cream">
          Field guide
        </h2>
        <p data-testid="guide-summary" className="mt-2 min-h-[3.75rem] max-w-2xl text-sm text-aura">
          {isEmptyGuide(guide)
            ? "Your field guide is empty: you haven't met any cats yet. They turn up on the dashboard while you work, or summon one below to meet it. Each card will keep count of how often you've met that cat, survived its attack and tamed it."
            : `You have met ${metCount} of the ${CAT_TYPES.length} cats. Each card counts how often you've met that cat, survived its attack and tamed it.`}
        </p>
      </section>
      <p
        role="status"
        aria-live="polite"
        data-testid="summon-status"
        className="mb-4 min-h-5 text-sm text-aura"
      >
        {status}
      </p>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {CAT_TYPES.map((type) => (
          <CatCard
            key={type.id}
            type={type}
            {...entryFor(guide, type.id)}
            disabled={disabled}
            onSummon={summon}
          />
        ))}
      </ul>
    </>
  );
}

/** One cat's card. Memoised: a count changing re-renders only that cat's card. */
const CatCard = memo(function CatCard({
  type,
  met,
  survived,
  tamed,
  disabled,
  onSummon,
}: {
  type: CatType;
  met: number;
  survived: number;
  tamed: number;
  disabled: boolean;
  onSummon: (type: CatType, asleep: boolean) => void;
}) {
  return (
    <li
      data-testid={`cat-card-${type.id}`}
      data-xenocat-card
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
            still
          />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-aura">No. {type.number}</p>
          <h2 className="text-lg font-semibold text-white">{type.name}</h2>
          <p className="text-sm font-medium text-plasma">{type.effect.name}</p>
        </div>
      </div>
      <p className="mt-3 grow text-sm text-aura">{type.effect.description}</p>
      <GuideEntry met={met} survived={survived} tamed={tamed} />
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button
          className="justify-center whitespace-nowrap px-1 text-[13px]"
          data-testid={`summon-${type.id}`}
          aria-label={`Summon ${type.name} awake`}
          disabled={disabled}
          onClick={() => onSummon(type, false)}
        >
          Summon awake
        </Button>
        <Button
          className="justify-center whitespace-nowrap px-1 text-[13px]"
          data-testid={`summon-asleep-${type.id}`}
          aria-label={`Summon ${type.name} asleep`}
          disabled={disabled}
          onClick={() => onSummon(type, true)}
        >
          Summon asleep
        </Button>
      </div>
    </li>
  );
});

/**
 * One card's field-guide counts, or a note that this cat has not been met yet. Both
 * are the same height, so meeting a cat never moves the card's buttons.
 */
function GuideEntry({ met, survived, tamed }: { met: number; survived: number; tamed: number }) {
  if (met === 0 && survived === 0 && tamed === 0) {
    return (
      <p
        data-testid="guide-entry"
        className="mt-3 flex h-14 items-center justify-center rounded-lg bg-void/60 text-xs italic text-aura/80"
      >
        Not met yet.
      </p>
    );
  }
  const stats = [
    ['Met', met],
    ['Attacks survived', survived],
    ['Tamed', tamed],
  ] as const;
  return (
    <dl data-testid="guide-entry" className="mt-3 grid h-14 grid-cols-3 gap-2 text-center">
      {stats.map(([label, value]) => (
        <div key={label} className="flex flex-col justify-center rounded-lg bg-void/60 px-1">
          <dt className="text-[11px] leading-tight text-aura">{label}</dt>
          <dd className="text-base font-semibold text-cream">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
