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
import { type Vec, strengthen } from './effects';
import { useXenocatCursor } from './fake-cursor';
import { recordStat } from './field-guide';
import { INTENSITY_CONFIG, getIntensity, subscribeIntensity } from './intensity';
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

/**
 * Browser tests pause the cats by setting this window property before the page
 * loads (Playwright's addInitScript, tests/e2e/fixtures.ts). It is read once, when
 * the cats start. Nothing in the app sets it: no button, no setting, no stored value.
 */
export const CATS_PAUSED_FLAG = '__xenocatsPaused';

const catsPaused = () =>
  typeof window !== 'undefined' &&
  (window as unknown as Record<string, unknown>)[CATS_PAUSED_FLAG] === true;

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
  // How often cats come and how many at once: the visitor's setting, where cats
  // come on their own (not where they only come when summoned). Normal is this
  // provider's own configuration, as it was created.
  const intensity = useSyncExternalStore(subscribeIntensity, getIntensity, () => 'normal' as const);
  const [normal] = useState(() => ({
    maxCats: engine.config.maxCats,
    firstSpawnMs: engine.config.firstSpawnMs,
    spawnEveryMs: engine.config.spawnEveryMs,
  }));
  useEffect(() => {
    if (!autoSpawn) return;
    if (intensity === 'normal' && engine.config.spawnEveryMs === normal.spawnEveryMs) return;
    engine.configure(intensity === 'normal' ? normal : INTENSITY_CONFIG[intensity]);
  }, [autoSpawn, engine, intensity, normal]);
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
  // Asks the loop below for a frame; it sleeps where no cat is due (see tick).
  const wakeRef = useRef<() => void>(() => {});

  // Fixed for the page's life, like the flag it comes from.
  const [paused] = useState(catsPaused);

  useEffect(() => {
    // Paused: no loop, so no cat comes and no effect starts.
    if (paused) return;
    const onResize = () => {
      // A cat the smaller screen no longer holds moves in: draw it there.
      // The page's own width and height, without a scrollbar: the cat layer's size
      // (the window's, where the page reports none, as jsdom does).
      const page = document.documentElement;
      const width = page.clientWidth || window.innerWidth;
      const height = page.clientHeight || window.innerHeight;
      if (engine.resize({ width, height })) {
        setCats(snapshot(engine));
      }
    };
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
    // touched, even while an effect runs.
    // A press that pokes a cat is the cat's: the rest of it (up to and including
    // its click) never reaches what lies beneath — a hidden Delete button, say.
    // Keyboard-made clicks (detail 0) never come through here.
    //
    // On a touch screen (or with a pen) nothing rests on a cat, so a press on a
    // sleeping cat is held instead: while it lasts, the finger is the resting pointer
    // (petting needs `petMs` of it, as with a mouse); let go sooner, it was a tap,
    // and the cat wakes as a click would wake it.
    let swallowPress = false;
    // The finger holding (pointerId): another finger neither moves nor ends the hold.
    let hold: { id: number; at: Vec; since: number } | null = null;
    const onPoke = (event: PointerEvent) => {
      // A second finger while one holds a cat leaves that hold as it is.
      if (hold && event.pointerType !== 'mouse') return;
      swallowPress = false;
      hold = null;
      const touched = { x: event.clientX, y: event.clientY };
      if (event.pointerType !== 'mouse') {
        if (engine.sleepingAt(touched)) {
          hold = { id: event.pointerId, at: touched, since: cursor.now() };
          swallowPress = true;
          event.preventDefault();
          event.stopPropagation();
          wake();
        }
        return;
      }
      const at = cursor.position() ?? touched;
      if (engine.poke(at, cursor.now())) {
        setCats(snapshot(engine));
        swallowPress = true;
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const onHoldMove = (event: PointerEvent) => {
      if (hold && event.pointerId === hold.id) hold.at = { x: event.clientX, y: event.clientY };
    };
    // The end of a held press: short of a pet, it was a tap, and the cat wakes.
    const onHoldEnd = (event: PointerEvent) => {
      if (!hold || event.pointerId !== hold.id) return;
      const { at, since } = hold;
      hold = null;
      if (cursor.now() - since < engine.config.petMs && engine.poke(at, cursor.now())) {
        setCats(snapshot(engine));
      }
      wake();
    };
    const onPressRest = (event: Event) => {
      if (!swallowPress) return;
      if (event.type === 'click' && (event as MouseEvent).detail === 0) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.type === 'click' || event.type === 'contextmenu') swallowPress = false;
    };
    const endPress = (event: PointerEvent) => {
      // Another finger's cancelled press leaves the hold alone.
      if (hold && event.pointerId !== hold.id) return;
      swallowPress = false;
      // A scroll or a system gesture took the press: neither pet nor poke.
      hold = null;
    };
    const pressRest = ['pointerup', 'mousedown', 'mouseup', 'click', 'contextmenu'] as const;
    window.addEventListener('pointerdown', onPoke, { capture: true });
    window.addEventListener('pointermove', onHoldMove, { capture: true });
    window.addEventListener('pointerup', onHoldEnd, { capture: true });
    for (const type of pressRest) window.addEventListener(type, onPressRest, { capture: true });
    window.addEventListener('pointercancel', endPress, { capture: true });

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

    const purr = (cat: Cat) => {
      const type = typesRef.current.find((t) => t.id === cat.typeId);
      if (type) player.play(soundsFor(type).purr);
    };

    const wake = () => {
      if (!frameId) frameId = requestAnimationFrame(tick);
    };
    wakeRef.current = wake;

    function tick() {
      frameId = 0;
      playPhases();
      // Petting needs the pointer on the page: one that has left it pets nothing.
      // A finger held on a cat is the pointer while it is held.
      const pointer = hold ? hold.at : cursor.isPresent() ? cursor.position() : null;
      const changed = engine.tick(
        cursor.now(),
        pointer,
        (cat, type, centre, combo) => {
          // A touch screen (no fake cursor) attacks the page around the last touch.
          // No cursor and no touch yet: the cat pounces at nothing and leaves, rather
          // than waiting on screen for ever.
          const touch = cursor.touchPoint();
          if (touch === null && cursor.position() === null) return true;
          // The pointer is off the page: wait, rather than spend an effect
          // nobody sees.
          if (touch === null && !cursor.isPresent()) return false;
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
      // Where cats only come when summoned and none is here, there is nothing to do
      // each frame: sleep until a summon wakes the loop.
      if (autoSpawn || engine.cats().length > 0) wake();
    }
    wake();

    return () => {
      cancelAnimationFrame(frameId);
      frameId = 0;
      wakeRef.current = () => {};
      window.removeEventListener('resize', onResize);
      for (const type of gestures) window.removeEventListener(type, unlock, { capture: true });
      window.removeEventListener('pointerdown', onPoke, { capture: true });
      window.removeEventListener('pointermove', onHoldMove, { capture: true });
      window.removeEventListener('pointerup', onHoldEnd, { capture: true });
      for (const type of pressRest)
        window.removeEventListener(type, onPressRest, { capture: true });
      window.removeEventListener('pointercancel', endPress, { capture: true });
    };
  }, [engine, cursor, player, autoSpawn, paused]);

  const api = useMemo<Xenocats>(
    () => ({
      summon: (typeId, options) => {
        if (paused) return false;
        const cat = engine.summon(typeId, cursor.now(), cursor.position(), options);
        if (cat) {
          setCats(snapshot(engine));
          wakeRef.current();
        }
        return cat !== null;
      },
      count: () => engine.cats().length,
      sound: (typeId, which) => {
        const type = typesRef.current.find((t) => t.id === typeId);
        if (type) player.play(soundsFor(type)[which]);
      },
    }),
    [engine, cursor, player, paused]
  );

  return (
    <CatsContext.Provider value={api}>
      <div
        ref={pageRef}
        data-testid="xenocat-page"
        data-cat-intensity={autoSpawn ? intensity : undefined}
      >
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
          eyes={catArt(type.id, 'eyes', { wholeSet: true })}
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
