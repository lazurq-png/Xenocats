'use client';

// Survival's start screen, above its options: three buttons, each opening a window.
// Select Character (who he goes out as), the Shop (the Tailor's wares) and the Codex
// (what the nights have shown him). Everything here reads and writes the stored
// progress (progression.ts); the run itself reads it when it starts.

import type { ComponentType, KeyboardEvent, ReactNode, RefObject, SVGProps } from 'react';
import { useId, useRef, useSyncExternalStore } from 'react';
import clsx from 'clsx';
import {
  ArrowPathIcon,
  ArrowTrendingUpIcon,
  ArrowUpCircleIcon,
  ArrowsPointingInIcon,
  ArrowsPointingOutIcon,
  ArrowsRightLeftIcon,
  BoltIcon,
  BookOpenIcon,
  ClockIcon,
  EyeIcon,
  FaceFrownIcon,
  ForwardIcon,
  GiftIcon,
  HandRaisedIcon,
  HeartIcon,
  LifebuoyIcon,
  LockClosedIcon,
  MoonIcon,
  NoSymbolIcon,
  ScissorsIcon,
  ShieldCheckIcon,
  SparklesIcon,
  Square2StackIcon,
  StarIcon,
  UserIcon,
  XMarkIcon,
} from '@heroicons/react/20/solid';
import { Button } from '@/app/ui/button';
import { HERO_BODY_SVGS } from './arena-art';
import { WEAPONS } from './arsenal';
import {
  CHARACTERS,
  type CharacterId,
  type CodexKind,
  MILESTONES,
  type Progress,
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

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

const svgUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/** Each character's colour: the halo his sprite is drawn with. */
const CHARACTER_TINT: Readonly<Record<CharacterId, string>> = {
  keeper: '#9d86ff',
  'night-porter': '#c1e838',
  housekeeper: '#e0e0b3',
  hairdresser: '#f472b6',
};

const UPGRADE_ICON: Readonly<Record<UpgradeId, Icon>> = {
  stubbornness: ShieldCheckIcon,
  sternness: FaceFrownIcon,
  'brisk-step': BoltIcon,
  'long-arms': ArrowsPointingOutIcon,
  'second-opinion': ArrowPathIcon,
  shrug: ForwardIcon,
  'thick-coat': LifebuoyIcon,
  'steady-hands': HandRaisedIcon,
  'wide-brim': ArrowsRightLeftIcon,
  'old-habits': ClockIcon,
  'kindly-manner': HeartIcon,
  'lint-roller': SparklesIcon,
  'deep-pockets': GiftIcon,
  patience: MoonIcon,
  'firm-no': NoSymbolIcon,
  'lucky-coat-button': StarIcon,
  'spare-pocket': Square2StackIcon,
  'second-wind': ArrowTrendingUpIcon,
};

const CODEX_GROUPS: readonly { title: string; kinds: readonly CodexKind[]; icon: Icon }[] = [
  { title: 'Evolutions', kinds: ['evolution', 'secret-evolution'], icon: ArrowUpCircleIcon },
  { title: 'Fusions', kinds: ['fusion'], icon: ArrowsPointingInIcon },
  { title: 'Secret', kinds: ['secret-cat'], icon: EyeIcon },
];

/** What an entry not yet found is, in its tile's words. */
const CODEX_KIND: Readonly<Record<CodexKind, string>> = {
  evolution: 'Evolution',
  'secret-evolution': 'Secret evolution',
  fusion: 'Fusion',
  'secret-cat': 'Secret cat',
};

const signed = (n: number, unit = '') =>
  n === 0 ? 'Standard' : `${n > 0 ? '+' : '−'}${Math.abs(n)}${unit}`;

export function ProgressionPanel() {
  const progress = useProgress();
  const character = useRef<HTMLDialogElement>(null);
  const shop = useRef<HTMLDialogElement>(null);
  const codex = useRef<HTMLDialogElement>(null);
  const entries = codexEntries(progress);
  const found = entries.filter((e) => e.found).length;

  return (
    <>
      {/* Stacked full width on a phone; side by side from a small tablet up. */}
      <div className="mt-6 grid gap-3 sm:flex sm:flex-wrap">
        <MenuButton
          icon={UserIcon}
          title="Select Character"
          onClick={() => character.current?.showModal()}
          testId="survival-open-character"
        >
          <span className="text-aura">{CHARACTERS[progress.character].name}</span>
        </MenuButton>
        <MenuButton
          icon={ScissorsIcon}
          title="Shop"
          onClick={() => shop.current?.showModal()}
          testId="survival-open-shop"
        >
          <span data-testid="survival-tufts" data-tufts={progress.tufts} className="text-plasma">
            Tufts of fur: {progress.tufts}
          </span>
        </MenuButton>
        <MenuButton
          icon={BookOpenIcon}
          title="Codex"
          onClick={() => codex.current?.showModal()}
          testId="survival-open-codex"
        >
          <span className="text-aura">
            {found} of {entries.length} found
          </span>
        </MenuButton>
      </div>

      <Window
        ref={character}
        title="Select Character"
        subtitle={
          <>
            Who goes out tonight. Tufts of fur:{' '}
            <span className="text-plasma">{progress.tufts}</span>
          </>
        }
        testId="survival-character-window"
        width="max-w-[65rem]"
      >
        <CharacterList progress={progress} onChosen={() => character.current?.close()} />
      </Window>

      <Window
        ref={shop}
        title="Shop"
        subtitle="The Tailor alters the coat. Permanently, and for tufts."
        aside={
          <span className="rounded-full bg-panel-raised px-3 py-1.5 text-sm font-semibold text-plasma">
            {progress.tufts} tufts
          </span>
        }
        testId="survival-shop-window"
        width="max-w-[60rem]"
      >
        <ShopList progress={progress} />
      </Window>

      <Window
        ref={codex}
        title="Codex"
        subtitle={`What the nights have shown him. ${found} of ${entries.length} found.`}
        testId="survival-codex-window"
        width="max-w-[65rem]"
      >
        <div data-testid="survival-codex">
          {CODEX_GROUPS.map((group) => {
            const tiles = entries.filter((e) => group.kinds.includes(e.kind));
            const headingId = `codex-${group.title.toLowerCase()}`;
            return (
              <section key={group.title} aria-labelledby={headingId} className="mt-5 first:mt-0">
                <h3
                  id={headingId}
                  className="font-display text-xs font-semibold uppercase tracking-[0.14em] text-aura"
                >
                  {group.title} · {tiles.filter((e) => e.found).length} / {tiles.length}
                </h3>
                <ul className="mt-2.5 grid grid-cols-[repeat(auto-fill,minmax(6.25rem,1fr))] gap-2">
                  {tiles.map((entry) => (
                    <li
                      key={entry.id}
                      data-found={entry.found}
                      className={clsx(
                        'flex flex-col items-center rounded-xl border bg-panel-raised px-1.5 py-2.5 text-center',
                        entry.found ? 'border-[#3b3f63] text-cream' : 'border-line text-white/60'
                      )}
                    >
                      <group.icon
                        aria-hidden="true"
                        className={clsx(
                          'size-9 rounded-[10px] bg-panel p-2',
                          entry.found ? 'text-plasma' : 'text-[#3b3f63]'
                        )}
                      />
                      <span className="mt-1.5 text-xs/4 font-semibold">{entry.name}</span>
                      <span className="mt-0.5 text-[10.5px]/[13px] text-aura">
                        {entry.recipe ?? CODEX_KIND[entry.kind]}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </Window>
    </>
  );
}

function MenuButton({
  icon: Icon,
  title,
  onClick,
  testId,
  children,
}: {
  icon: Icon;
  title: string;
  onClick: () => void;
  testId: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      aria-haspopup="dialog"
      className="flex min-h-14 items-center gap-3 rounded-[14px] border border-line bg-panel py-2 pl-2 pr-5 text-left text-cream transition hover:border-aura focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plasma"
    >
      <span className="flex size-10 items-center justify-center rounded-[10px] bg-panel-raised text-plasma">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <span>
        <span className="block font-display text-[15px] font-semibold">{title}</span>
        <span className="block text-[13px]">{children}</span>
      </span>
    </button>
  );
}

/**
 * One of the start screen's windows: a native modal <dialog>, so the page behind it is
 * inert, Esc closes it and focus goes back to the button that opened it. Tab and
 * Shift+Tab also stay inside it.
 */
function Window({
  ref,
  title,
  subtitle,
  aside,
  testId,
  width,
  children,
}: {
  ref: RefObject<HTMLDialogElement | null>;
  title: string;
  subtitle: ReactNode;
  aside?: ReactNode;
  testId: string;
  width: string;
  children: ReactNode;
}) {
  const titleId = useId();
  const onKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== 'Tab') return;
    const focusable = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled])')
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
  };
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onKeyDown={onKeyDown}
      data-testid={testId}
      className={clsx(
        'm-auto max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] overflow-y-auto rounded-2xl border border-line bg-panel p-5 text-left text-white backdrop:bg-void/75 sm:max-h-[calc(100dvh-2rem)] sm:w-[calc(100vw-2rem)] sm:p-7',
        width
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id={titleId} className="font-display text-[26px]/8 font-semibold text-cream">
            {title}
          </h2>
          <p className="mt-1 text-sm text-aura">{subtitle}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {aside}
          <button
            type="button"
            aria-label="Close"
            onClick={() => ref.current?.close()}
            className="flex size-11 items-center justify-center rounded-xl border border-line bg-panel-raised text-cream hover:border-aura focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-plasma"
          >
            <XMarkIcon aria-hidden="true" className="size-5" />
          </button>
        </div>
      </div>
      <div className="mt-6">{children}</div>
    </dialog>
  );
}

function CharacterList({ progress, onChosen }: { progress: Progress; onChosen: () => void }) {
  const base = CHARACTERS.keeper;
  return (
    // Each card's parts share the row's tracks (subgrid), so the weapon, the numbers and
    // the button line up across a row whatever the length of the words above them.
    <ul className="grid grid-cols-[repeat(auto-fit,minmax(13.5rem,1fr))] gap-x-4 gap-y-3">
      {(Object.keys(CHARACTERS) as CharacterId[]).map((id) => {
        const character = CHARACTERS[id];
        const had = hasCharacter(progress, id);
        const chosen = progress.character === id;
        const unlock = character.unlock;
        const weapon = WEAPONS[character.weapon];
        const pace = Math.round((character.speed / base.speed - 1) * 100);
        return (
          <li
            key={id}
            data-testid={`survival-card-${id}`}
            className={clsx(
              'row-span-6 grid grid-rows-subgrid gap-y-0 rounded-2xl bg-[#0d1224] p-3.5',
              chosen ? 'border-2 border-plasma shadow-glow' : 'border border-line'
            )}
          >
            <div
              className="relative flex aspect-square items-center justify-center overflow-hidden rounded-xl"
              style={{
                background: `radial-gradient(circle at 50% 60%, ${CHARACTER_TINT[id]}33, #12162b 70%)`,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- the game's own sprite, an inline SVG */}
              <img
                src={svgUrl(HERO_BODY_SVGS[id].S)}
                alt=""
                className={clsx('size-[92%] object-contain', !had && 'brightness-[0.45] grayscale')}
              />
              {!had && (
                <LockClosedIcon
                  aria-hidden="true"
                  className="absolute size-8 text-cream drop-shadow"
                />
              )}
            </div>
            <h3 className="mt-3.5 font-display text-base font-semibold text-cream">
              {character.name}
            </h3>
            <p className="mt-1.5 text-[13px]/[19px] italic text-cream">“{character.description}”</p>
            <div className="mt-3 rounded-[10px] bg-panel-raised px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-aura">
                Starting weapon
              </p>
              <p className="mt-0.5 text-sm font-semibold text-plasma">{weapon.name}</p>
              <p className="mt-0.5 text-xs/[17px] text-aura">{weapon.description}</p>
            </div>
            <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[13px]">
              <dt className="text-aura">Resolve</dt>
              <dd className="text-right text-white">{signed(character.resolve)}</dd>
              <dt className="text-aura">Pace</dt>
              <dd className="text-right text-white">{signed(pace, '%')}</dd>
            </dl>
            <div className="mt-3.5 self-end">
              {had ? (
                <button
                  type="button"
                  data-testid={`survival-character-${id}`}
                  aria-pressed={chosen}
                  onClick={() => {
                    writeProgress(chooseCharacter(readProgress(), id));
                    onChosen();
                  }}
                  className={clsx(
                    'min-h-11 w-full rounded-xl text-sm font-semibold focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plasma',
                    chosen
                      ? 'bg-plasma text-void'
                      : 'border border-aura text-cream hover:bg-panel-raised'
                  )}
                >
                  {chosen ? 'Going out tonight' : 'Choose'}
                </button>
              ) : unlock.kind === 'cost' ? (
                <Button
                  className="w-full justify-center"
                  data-testid={`survival-buy-${id}`}
                  aria-disabled={progress.tufts < unlock.cost}
                  onClick={() => {
                    const next = buyCharacter(readProgress(), id);
                    if (next) writeProgress(next);
                  }}
                >
                  Engage for {unlock.cost} tufts
                </Button>
              ) : (
                <button
                  type="button"
                  data-testid={`survival-character-${id}`}
                  disabled
                  className="min-h-11 w-full cursor-not-allowed rounded-xl border border-line text-sm font-semibold text-aura"
                >
                  {unlock.kind === 'milestone'
                    ? `Locked: ${MILESTONES[unlock.milestone].text}.`
                    : 'Locked'}
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function ShopList({ progress }: { progress: Progress }) {
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,9.25rem),1fr))] gap-2">
      {(Object.keys(UPGRADES) as UpgradeId[]).map((id) => {
        const upgrade = UPGRADES[id];
        const level = progress.upgrades[id] ?? 0;
        const cost = upgradeCost(id, level);
        const Icon = UPGRADE_ICON[id];
        return (
          <li
            key={id}
            data-testid={`survival-upgrade-${id}`}
            data-level={level}
            className="flex flex-col items-center rounded-xl border border-line bg-panel-raised px-2.5 py-3 text-center"
          >
            <Icon aria-hidden="true" className="size-9 rounded-[10px] bg-panel p-2 text-plasma" />
            <span className="mt-1.5 text-[13px]/4 font-semibold text-cream">{upgrade.name}</span>
            <span className="mt-1 text-[11px]/[14px] text-aura">{upgrade.description}</span>
            <span
              role="img"
              aria-label={`Level ${level} of ${upgrade.maxLevel}`}
              className="mt-2 flex gap-[3px]"
            >
              {Array.from({ length: upgrade.maxLevel }, (_, i) => (
                <span
                  key={i}
                  className={clsx(
                    'h-[5px] w-3.5 rounded-full',
                    i < level ? 'bg-plasma' : 'bg-line'
                  )}
                />
              ))}
            </span>
            <span aria-hidden="true" className="min-h-2.5 flex-1" />
            <Button
              className="h-11 w-full justify-center"
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
  );
}
