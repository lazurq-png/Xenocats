'use client';

import {
  type CSSProperties,
  type RefObject,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { SpeakerWaveIcon, SpeakerXMarkIcon } from '@heroicons/react/24/solid';
import { type Cat, type CatEngine, type CatPhase, createCatEngine } from './cat-engine';
import { catArt } from './cat-art';
import { CatSprite } from './cat-sprite';
import { CAT_TYPES, type CatType } from './cat-types';
import type { CatConfig } from './config';
import { strengthen } from './effects';
import { useXenocatCursor } from './fake-cursor';
import { recordStat } from './field-guide';
import {
  type CatSounds,
  sharedSoundPlayer,
  getSoundEnabled,
  setSoundEnabled,
  soundsFor,
  subscribeSound,
} from './sounds';

export type Xenocats = {
  /**
   * Brings a cat of this type on screen to attack at once or, `asleep`, to sleep
   * and wake first. False if 5 are already there.
   */
  summon(typeId: string, options?: { asleep?: boolean }): boolean;
  /** How many of these cats are on screen now. */
  count(): number;
  /** Plays one of a cat type's sounds (if sound is on and allowed yet). */
  sound(typeId: string, which: keyof CatSounds): void;
};

const CatsContext = createContext<Xenocats | null>(null);

export function useXenocats(): Xenocats {
  const cats = useContext(CatsContext);
  if (!cats) throw new Error('useXenocats must be used inside <XenocatCatsProvider>.');
  return cats;
}

const snapshot = (engine: CatEngine) => engine.cats().map((cat) => ({ ...cat }));

/**
 * Runs the cats over whatever it wraps. Must sit inside <XenocatCursorProvider>,
 * whose clock, random source and cursor it shares.
 */
export function XenocatCatsProvider({
  children,
  autoSpawn = true,
  types = CAT_TYPES,
  config,
}: {
  children: React.ReactNode;
  /** False where cats only come when summoned. */
  autoSpawn?: boolean;
  types?: readonly CatType[];
  config?: Partial<CatConfig>;
}) {
  const cursor = useXenocatCursor();
  const [engine] = useState(() =>
    createCatEngine({
      random: cursor.random,
      types,
      viewport: { width: 0, height: 0 },
      autoSpawn,
      config,
    })
  );
  const [cats, setCats] = useState<Cat[]>([]);
  const [player] = useState(() => sharedSoundPlayer());
  // Read by the loop and the API, which should not restart when a caller passes a
  // new (equal) list.
  const typesRef = useRef(types);
  useEffect(() => {
    typesRef.current = types;
  }, [types]);
  // What a stomp shakes: the page content only. The cat layer (below) and the fake
  // cursor sit outside it, so a transform here can never move them.
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onResize = () => engine.resize({ width: window.innerWidth, height: window.innerHeight });
    onResize();
    window.addEventListener('resize', onResize);

    let frameId = 0;
    // Browsers let audio start only after a user gesture: one of these (on a touch
    // screen only pointerup, touchend and click count).
    const unlock = () => player.unlock();
    const gestures = [
      'keydown',
      'mousedown',
      'pointerdown',
      'pointerup',
      'touchend',
      'click',
    ] as const;
    for (const type of gestures) window.addEventListener(type, unlock, { capture: true });

    // Clicking a sleeping cat wakes it at once, angry. The click itself goes on to
    // whatever is under the cat, as always (the cats never take clicks).
    // A mouse click lands where the visible cursor is; a tap or a pen, where it
    // touched. Not while an effect blocks clicks.
    const onPoke = (event: PointerEvent) => {
      if (cursor.isBusy()) return;
      const touched = { x: event.clientX, y: event.clientY };
      const at = event.pointerType === 'mouse' ? (cursor.position() ?? touched) : touched;
      if (engine.poke(at, cursor.now())) {
        setCats(snapshot(engine));
      }
    };
    window.addEventListener('pointerdown', onPoke, { capture: true });

    // A cat's sounds follow its phases: arriving, then waking up.
    const phases = new Map<number, CatPhase>();
    const playPhases = () => {
      const seen = new Set<number>();
      for (const cat of engine.cats()) {
        seen.add(cat.id);
        if (phases.get(cat.id) === cat.phase) continue;
        phases.set(cat.id, cat.phase);
        const type = typesRef.current.find((t) => t.id === cat.typeId);
        if (!type) continue;
        if (cat.phase === 'appearing') {
          player.play(soundsFor(type).arrive);
          recordStat(type.id, 'met');
        }
        if (cat.phase === 'waking') player.play(soundsFor(type).wake);
      }
      for (const id of phases.keys()) if (!seen.has(id)) phases.delete(id);
    };

    const tick = () => {
      playPhases();
      const purr = (cat: Cat) => {
        const type = typesRef.current.find((t) => t.id === cat.typeId);
        if (type) player.play(soundsFor(type).purr);
      };
      // Petting needs the pointer on the page: one that has left it pets nothing.
      const pointer = cursor.isPresent() ? cursor.position() : null;
      const changed = engine.tick(
        cursor.now(),
        pointer,
        (cat, type, centre, combo) => {
          // No cursor at all (a touch screen, or the pointer not seen yet): the cat
          // pounces at nothing and leaves, rather than waiting on screen for ever.
          if (cursor.position() === null) return true;
          // The pointer is off the page: wait, rather than block clicks with an effect
          // nobody sees.
          if (!cursor.isPresent()) return false;
          // The page is drawing its own pointer (a locked Fight game): wait until it is done.
          if (cursor.isHidden()) return false;
          // A combo attacks with both cats' fused effect; a cat clicked awake (either
          // of the pair) attacks angrily: harder and for longer.
          const partner = combo ? engine.cats().find((c) => c.id === cat.comboWith) : undefined;
          const partnerType = partner
            ? typesRef.current.find((t) => t.id === partner.typeId)
            : undefined;
          const base = combo ? combo.effect : type.effect;
          const effect =
            cat.angry || partner?.angry ? strengthen(base, engine.config.angryFactor) : base;
          if (!cursor.attack(effect, centre)) return false;
          for (const attacker of partnerType ? [type, partnerType] : [type]) {
            player.play(soundsFor(attacker).attack);
            recordStat(attacker.id, 'survived');
          }
          return true;
        },
        purr
      );
      if (changed) setCats(snapshot(engine));
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', onResize);
      for (const type of gestures) window.removeEventListener(type, unlock, { capture: true });
      window.removeEventListener('pointerdown', onPoke, { capture: true });
    };
  }, [engine, cursor, player]);

  const api = useMemo<Xenocats>(
    () => ({
      summon: (typeId, options) => {
        const cat = engine.summon(typeId, cursor.now(), cursor.position(), options);
        if (cat) setCats(snapshot(engine));
        return cat !== null;
      },
      count: () => engine.cats().length,
      sound: (typeId, which) => {
        const type = typesRef.current.find((t) => t.id === typeId);
        if (type) player.play(soundsFor(type)[which]);
      },
    }),
    [engine, cursor, player]
  );

  return (
    <CatsContext.Provider value={api}>
      <div ref={pageRef} data-testid="xenocat-page">
        {children}
      </div>
      <div
        aria-hidden="true"
        data-testid="xenocat-layer"
        className="pointer-events-none fixed inset-0 z-[9998] overflow-hidden"
      >
        {cats.map((cat) => {
          const type = types.find((t) => t.id === cat.typeId);
          return type ? (
            <CatView
              key={cat.id}
              cat={cat}
              type={type}
              config={engine.config}
              shakeTarget={pageRef}
            />
          ) : null;
        })}
      </div>
      <SoundToggle />
    </CatsContext.Provider>
  );
}

export const SHAKE_CLASS = 'xenocat-shake';
export const SHAKE_MS = 350;

/**
 * Shakes the page content when a heavy cat lands (part-way into its arrival) and
 * when it stomps off. Only for cat types with `shake`. Never <body>: a transform
 * there would re-anchor every `position: fixed` layer — the cats and the fake
 * cursor — to the scrolled document for the duration.
 */
function useStompShake(type: CatType, phase: Cat['phase'], target: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const body = target.current;
    if (!body || !type.shake || (phase !== 'appearing' && phase !== 'leaving')) return;
    const landsAfter = phase === 'appearing' ? type.entranceMs * 0.6 : 0;
    let stop = 0;
    const start = window.setTimeout(() => {
      body.classList.add(SHAKE_CLASS);
      stop = window.setTimeout(() => body.classList.remove(SHAKE_CLASS), SHAKE_MS);
    }, landsAfter);
    return () => {
      window.clearTimeout(start);
      window.clearTimeout(stop);
      body.classList.remove(SHAKE_CLASS);
    };
  }, [type, phase, target]);
}

function CatView({
  cat,
  type,
  config,
  shakeTarget,
}: {
  cat: Cat;
  type: CatType;
  config: CatConfig;
  shakeTarget: RefObject<HTMLElement | null>;
}) {
  useStompShake(type, cat.phase, shakeTarget);
  const size = config.catSize;
  // The arrival and departure animate the whole cat; the phases in between animate
  // the inner figure, so the two never fight over one `transform`.
  const outer =
    cat.phase === 'appearing'
      ? { className: `xenocat-enter-${type.entrance}`, ms: type.entranceMs }
      : cat.phase === 'leaving'
        ? { className: `xenocat-exit-${type.exit}`, ms: type.exitMs }
        : null;
  const style: CSSProperties & { '--xenocat-ms'?: string } = {
    left: cat.x,
    top: cat.y,
    width: size,
    height: size,
    animationDuration: outer ? `${outer.ms}ms` : undefined,
    // For animations that stage parts of the cat (e.g. eyes before body).
    '--xenocat-ms': outer ? `${outer.ms}ms` : undefined,
  };
  const asleep = cat.phase === 'sleeping';
  // The one-shot phase animations last exactly as long as their phase (config.ts).
  const innerMs =
    cat.phase === 'waking' ? config.wakeMs : cat.phase === 'attacking' ? config.attackMs : null;

  return (
    <div
      data-testid="xenocat"
      data-cat-type={type.id}
      data-phase={cat.phase}
      data-angry={cat.angry || undefined}
      data-combo={cat.combo ?? undefined}
      data-petted={cat.petted || undefined}
      className={`absolute ${outer?.className ?? ''} ${cat.angry ? 'xenocat-angry' : ''}`}
      style={style}
    >
      <div
        className={`xenocat-${cat.phase} h-full w-full`}
        style={innerMs === null ? undefined : { animationDuration: `${innerMs}ms` }}
      >
        <CatSprite
          palette={type.palette}
          look={type.look}
          pose={asleep ? 'asleep' : 'awake'}
          size={size}
          art={catArt(type.id, asleep ? 'asleep' : 'awake', { wholeSet: true })}
        />
      </div>
      {asleep && (
        <div className="absolute -top-1 right-1" style={{ color: type.palette.glow }}>
          <span className="xenocat-z">z</span>
          <span className="xenocat-z" style={{ animationDelay: '0.8s' }}>
            z
          </span>
          <span className="xenocat-z" style={{ animationDelay: '1.6s' }}>
            Z
          </span>
        </div>
      )}
    </div>
  );
}

/** The speaker in the corner: cat sounds on (the default) or off, remembered. */
function SoundToggle() {
  const on = useSyncExternalStore(subscribeSound, getSoundEnabled, () => true);
  const Icon = on ? SpeakerWaveIcon : SpeakerXMarkIcon;
  return (
    <button
      type="button"
      data-testid="sound-toggle"
      data-xenocat-ignore
      aria-label="Cat sounds"
      aria-pressed={on}
      title={on ? 'Cat sounds on' : 'Cat sounds off'}
      onClick={() => setSoundEnabled(!on)}
      className="fixed bottom-4 right-4 z-[9997] flex h-10 w-10 items-center justify-center rounded-full border border-line bg-panel text-aura shadow-glow transition hover:text-plasma focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plasma"
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}
