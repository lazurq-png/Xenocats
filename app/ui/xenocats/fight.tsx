'use client';

import { memo, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/app/ui/button';
import { useXenocats } from './cat-layer';
import { catArt } from './cat-art';
import { CatSprite } from './cat-sprite';
import { CAT_TYPES, catTypeById } from './cat-types';
import { CAT_CONFIG } from './config';
import { MAX_DECOYS, type Vec } from './effects';
import { CursorShape, placeCursor, useXenocatCursor } from './fake-cursor';
import { type LockedPointer, createLockedPointer } from './locked-pointer';
import {
  SURVIVAL_BEST_KEY,
  type Survival,
  type SurvivalSnapshot,
  bestScore,
  createGameClock,
  createSurvival,
} from './survival';
import {
  TAMED_KEY,
  type Taming,
  type TamingSnapshot,
  addTamed,
  createTaming,
  parseCollection,
} from './taming';

// Fight a cat, on the /cats page. Start asks for pointer lock: the browser hides the
// system pointer and the game owns the pointer's position, so the cats attack that
// pointer itself (locked-pointer.ts). Esc releases the lock and ends the game;
// losing it any other way (another tab, another window) pauses it. Where pointer
// lock is refused or missing, the game runs with the page's fake cursor instead.
//
// Two games: Survival (survival.ts) and Taming (taming.ts), where one cat at a time
// dodges the pointer and holding still on it for 2 s tames it, into a collection
// kept in localStorage.

type Mode = 'locked' | 'fallback';
type Phase = 'idle' | 'playing' | 'paused' | 'over';
type Kind = 'survival' | 'taming';

type Game = {
  clock: ReturnType<typeof createGameClock>;
  mode: Mode;
  pointer: LockedPointer | null;
} & ({ kind: 'survival'; survival: Survival } | { kind: 'taming'; taming: Taming });

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function readCollectionRaw(): string | null {
  try {
    return window.localStorage.getItem(TAMED_KEY);
  } catch {
    return null;
  }
}

/** How many cats have been tamed in all, from localStorage. */
function readTamedTotal(): number {
  const collection = parseCollection(readCollectionRaw(), CAT_TYPES);
  return Object.values(collection).reduce((sum, count) => sum + count, 0);
}

/** Adds a tamed cat to the stored collection. */
function storeTamed(typeId: string) {
  try {
    const collection = parseCollection(readCollectionRaw(), CAT_TYPES);
    window.localStorage.setItem(TAMED_KEY, JSON.stringify(addTamed(collection, typeId)));
  } catch {
    // Storage blocked or full: the cat is tamed for this game only.
  }
}

function readBest(): number | null {
  try {
    const value = Number(window.localStorage.getItem(SURVIVAL_BEST_KEY));
    return Number.isInteger(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

/** Another tab may set a new best. */
function subscribeBest(onChange: () => void) {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
}

function writeBest(score: number) {
  try {
    window.localStorage.setItem(SURVIVAL_BEST_KEY, String(score));
  } catch {
    // Storage blocked or full: the best score just isn't kept.
  }
}

/** Asks for pointer lock on <body>. Resolves false if it is missing or refused. */
function requestLock(): Promise<boolean> {
  const target = document.body;
  if (typeof target.requestPointerLock !== 'function') return Promise.resolve(false);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (locked: boolean) => {
      if (settled) return;
      settled = true;
      document.removeEventListener('pointerlockchange', onChange);
      document.removeEventListener('pointerlockerror', onError);
      window.clearTimeout(timeout);
      resolve(locked);
    };
    const onChange = () => finish(document.pointerLockElement === target);
    const onError = () => finish(false);
    // Some browsers neither grant nor refuse when they will not lock.
    const timeout = window.setTimeout(() => {
      const locked = document.pointerLockElement === target;
      finish(locked);
      // The game has gone on without the lock; release it if it is granted late.
      if (!locked) {
        const release = () => {
          if (document.pointerLockElement === target) document.exitPointerLock();
        };
        document.addEventListener('pointerlockchange', release, { once: true });
      }
    }, 1000);
    document.addEventListener('pointerlockchange', onChange);
    document.addEventListener('pointerlockerror', onError);
    try {
      // A promise in current browsers, undefined in older ones.
      const result = target.requestPointerLock() as unknown;
      if (result instanceof Promise) result.catch(() => finish(false));
    } catch {
      finish(false);
    }
  });
}

/** Puts a cat's element so the cat is centred on `at`. */
function placeCat(element: HTMLElement, at: Vec) {
  element.style.left = `${at.x - CAT_CONFIG.catSize / 2}px`;
  element.style.top = `${at.y - CAT_CONFIG.catSize / 2}px`;
}

const viewportSize = () => ({ width: window.innerWidth, height: window.innerHeight });

export default function Fight({
  onPlayingChange,
}: {
  /** True from Start until the game is over, paused included. */
  onPlayingChange?: (playing: boolean) => void;
}) {
  const cursor = useXenocatCursor();
  const cats = useXenocats();
  const [phase, setPhase] = useState<Phase>('idle');
  const [mode, setMode] = useState<Mode>('fallback');
  const [kind, setKind] = useState<Kind>('survival');
  const [snap, setSnap] = useState<SurvivalSnapshot | null>(null);
  const [tameSnap, setTameSnap] = useState<TamingSnapshot | null>(null);
  // Read on every render, so what a game just wrote shows at once.
  const best = useSyncExternalStore(subscribeBest, readBest, () => null);
  const tamedTotal = useSyncExternalStore(subscribeBest, readTamedTotal, () => 0);
  const [message, setMessage] = useState('');
  const gameRef = useRef<Game | null>(null);
  const phaseRef = useRef<Phase>('idle');
  const pointerRef = useRef<HTMLDivElement>(null);
  const decoyRefs = useRef<(HTMLDivElement | null)[]>([]);
  const startRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  // Cats move every frame, so the loop moves their elements itself; React renders
  // only when what it shows changes (a cat comes or goes, a life, a wave, the hold).
  const shownRef = useRef('');
  // Set from Start until the game begins: asking for the lock can take a second.
  const startingRef = useRef(false);

  const changePhase = useCallback(
    (next: Phase) => {
      phaseRef.current = next;
      setPhase(next);
      onPlayingChange?.(next === 'playing' || next === 'paused');
    },
    [onPlayingChange]
  );

  const finish = useCallback(() => {
    const game = gameRef.current;
    if (!game || phaseRef.current === 'over' || phaseRef.current === 'idle') return;
    if (document.pointerLockElement) document.exitPointerLock();
    cursor.hide(false);
    if (game.kind === 'survival') {
      const final = game.survival.snapshot();
      const kept = bestScore(readBest(), final.score);
      writeBest(kept);
      setSnap(final);
      setMessage(`Game over. You survived ${plural(final.score, 'wave', 'waves')}. Best: ${kept}.`);
    } else {
      const tamed = game.taming.snapshot(game.clock.now(performance.now())).tamed.length;
      setMessage(`Taming over. You tamed ${plural(tamed, 'cat', 'cats')}.`);
    }
    changePhase('over');
  }, [cursor, changePhase]);

  const pause = useCallback(() => {
    const game = gameRef.current;
    if (!game || phaseRef.current !== 'playing') return;
    game.clock.pause(performance.now());
    cursor.hide(false);
    setMessage('Paused.');
    changePhase('paused');
  }, [cursor, changePhase]);

  const begin = (game: Game) => {
    gameRef.current = game;
    shownRef.current = '';
    setMode(game.mode);
    setKind(game.kind);
    if (game.kind === 'survival') setSnap(game.survival.snapshot());
    else setTameSnap(game.taming.snapshot(0));
    cursor.hide(game.mode === 'locked');
    const stop = game.mode === 'locked' ? 'Press Esc to stop.' : 'Press Esc or End game to stop.';
    setMessage(
      game.kind === 'survival'
        ? `The cats are coming. ${stop}`
        : `Keep still and a cat will come. Hold still on it to tame it. ${stop}`
    );
    changePhase('playing');
  };

  const start = async (kind: Kind) => {
    if (startingRef.current || phaseRef.current === 'playing' || phaseRef.current === 'paused') {
      return;
    }
    startingRef.current = true;
    const locked = await requestLock();
    startingRef.current = false;
    const viewport = viewportSize();
    const at: Vec = cursor.position() ?? { x: viewport.width / 2, y: viewport.height / 2 };
    const common = {
      clock: createGameClock(performance.now()),
      mode: (locked ? 'locked' : 'fallback') as Mode,
      pointer: locked ? createLockedPointer({ viewport, start: at, random: cursor.random }) : null,
    };
    const options = { random: cursor.random, types: CAT_TYPES, viewport, now: 0 };
    begin(
      kind === 'survival'
        ? { ...common, kind, survival: createSurvival(options) }
        : { ...common, kind, taming: createTaming(options) }
    );
  };

  const resume = async () => {
    const game = gameRef.current;
    if (!game || phaseRef.current !== 'paused') return;
    if (game.mode === 'locked' && !(await requestLock())) {
      // Refused this time: carry on with the fake cursor.
      game.mode = 'fallback';
      game.pointer = null;
      setMode('fallback');
    }
    game.clock.resume(performance.now());
    cursor.hide(game.mode === 'locked');
    setMessage('');
    changePhase('playing');
  };

  // Move focus into the game when it starts and back to Start when it is over.
  useEffect(() => {
    if (phase === 'playing' || phase === 'paused') dialogRef.current?.focus();
    if (phase === 'over') startRef.current?.querySelector('button')?.focus();
  }, [phase]);

  // The game loop, and everything that can pause or end the game.
  const running = phase === 'playing' || phase === 'paused';
  useEffect(() => {
    if (!running) return;
    const game = gameRef.current;
    if (!game) return;

    // Each game cat makes its arrival sound once, when it first shows up.
    const heard = new Set<number>();
    const hearArrivals = (list: readonly { id: number; typeId: string }[]) => {
      for (const cat of list) {
        if (heard.has(cat.id)) continue;
        heard.add(cat.id);
        cats.sound(cat.typeId, 'arrive');
      }
    };

    const moveCats = (list: readonly { id: number; x: number; y: number }[]) => {
      const elements = dialogRef.current?.querySelectorAll<HTMLElement>('[data-cat-id]') ?? [];
      for (const element of elements) {
        const cat = list.find((c) => String(c.id) === element.dataset.catId);
        if (cat) placeCat(element, cat);
      }
    };

    let frameId = 0;
    const loop = () => {
      if (phaseRef.current === 'playing') {
        const now = game.clock.now(performance.now());
        let at: Vec;
        if (game.mode === 'locked' && game.pointer) {
          const look = game.pointer.frame(now);
          at = { x: look.x, y: look.y };
          const element = pointerRef.current;
          if (element) placeCursor(element, look, look);
          const decoys = look.decoys ?? [];
          decoyRefs.current.forEach((decoy, i) => {
            if (!decoy) return;
            if (i < decoys.length) placeCursor(decoy, decoys[i], look);
            else decoy.style.opacity = '0';
          });
        } else {
          const viewport = viewportSize();
          at = cursor.position() ?? { x: viewport.width / 2, y: viewport.height / 2 };
        }
        if (game.kind === 'taming') {
          const tamed = game.taming.tick(now, at, CAT_CONFIG.maxCats - cats.count());
          if (tamed) {
            storeTamed(tamed);
            setMessage(`You tamed ${catTypeById(tamed)?.name ?? 'a cat'}!`);
          }
          const snapshot = game.taming.snapshot(now);
          hearArrivals(snapshot.cat ? [snapshot.cat] : []);
          moveCats(snapshot.cat ? [snapshot.cat] : []);
          const { cat, hold } = snapshot;
          const key = `${cat?.id}|${cat?.doing}|${Math.round(hold * 50)}|${snapshot.tamed.length}`;
          if (key !== shownRef.current) {
            shownRef.current = key;
            setTameSnap(snapshot);
          }
        } else {
          const landed = game.survival.tick(now, at, CAT_CONFIG.maxCats - cats.count());
          for (const cat of landed) {
            const type = catTypeById(cat.typeId);
            if (!type) continue;
            // One effect at a time: a cat landing during another's still costs a life.
            const hit =
              game.mode === 'locked' && game.pointer
                ? game.pointer.attack(type.effect, cat, now)
                : cursor.attack(type.effect, cat);
            if (hit) cats.sound(type.id, 'attack');
          }
          const snapshot = game.survival.snapshot();
          hearArrivals(snapshot.cats);
          moveCats(snapshot.cats);
          const { status, lives, wave, score } = snapshot;
          const ids = snapshot.cats.map((cat) => cat.id).join(',');
          const key = `${status}|${lives}|${wave}|${score}|${ids}`;
          if (key !== shownRef.current) {
            shownRef.current = key;
            setSnap(snapshot);
          }
          if (snapshot.status === 'over') {
            finish();
            return;
          }
        }
      }
      frameId = requestAnimationFrame(loop);
    };
    frameId = requestAnimationFrame(loop);

    const onMouseMove = (event: MouseEvent) => {
      if (phaseRef.current !== 'playing' || !game.pointer) return;
      if (document.pointerLockElement !== document.body) return;
      game.pointer.move(event.movementX, event.movementY);
    };
    const onMouseDown = (event: MouseEvent) => {
      if (phaseRef.current !== 'playing' || event.button !== 0 || !game.pointer) return;
      if (game.kind !== 'survival' || document.pointerLockElement !== document.body) return;
      // Clicks are blocked while an effect runs, as they are for the fake cursor.
      if (game.pointer.activeEffectId(game.clock.now(performance.now())) !== null) return;
      if (game.survival.click(game.pointer.position())) setSnap(game.survival.snapshot());
    };
    const onLockChange = () => {
      // The game releasing the lock itself (it is over) is not a loss.
      if (phaseRef.current !== 'playing' || game.mode !== 'locked') return;
      if (document.pointerLockElement === document.body) return;
      // Esc leaves the page focused and visible; a tab or window switch does not.
      // Their blur and visibility events can arrive just after the lock is lost.
      window.setTimeout(() => {
        if (document.hasFocus() && document.visibilityState === 'visible') finish();
        else pause();
      }, 100);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finish();
    };
    const onHidden = () => {
      if (document.visibilityState === 'hidden') pause();
    };
    const onResize = () => {
      if (game.kind === 'survival') game.survival.resize(viewportSize());
      else game.taming.resize(viewportSize());
      game.pointer?.resize(viewportSize());
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('pointerlockchange', onLockChange);
    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('blur', pause);
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(frameId);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('pointerlockchange', onLockChange);
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('blur', pause);
      window.removeEventListener('resize', onResize);
    };
  }, [running, cursor, cats, finish, pause]);

  // Leaving the page mid-game: give the pointer back.
  useEffect(
    () => () => {
      if (document.pointerLockElement) document.exitPointerLock();
      cursor.hide(false);
    },
    [cursor]
  );

  // Without pointer lock, a click lands where the real pointer is; the fake cursor
  // provider has already swallowed it if an effect is running.
  const onOverlayPointerDown = (event: React.PointerEvent) => {
    const game = gameRef.current;
    if (!game || game.mode !== 'fallback' || phaseRef.current !== 'playing') return;
    if (game.kind !== 'survival' || event.button !== 0) return;
    if (game.survival.click({ x: event.clientX, y: event.clientY })) {
      setSnap(game.survival.snapshot());
    }
  };

  const size = CAT_CONFIG.catSize;

  return (
    <section
      aria-labelledby="fight-heading"
      className="mb-10 rounded-2xl border border-line bg-panel p-6"
    >
      <h2 id="fight-heading" className="font-display text-2xl font-semibold text-cream">
        Fight a cat
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-aura">
        <span className="font-semibold text-white">Survival.</span> Cats come in waves, faster and
        more often each time. Click a cat to banish it; every cat that reaches your pointer costs
        one of 3 lives.
      </p>
      <p className="mt-2 max-w-2xl text-sm text-aura">
        <span className="font-semibold text-white">Taming.</span> One cat at a time, and it dodges
        your pointer, each kind in its own way. Keep still and it gets curious; hold your pointer
        still on it for 2 seconds to tame it.
      </p>
      <p className="mt-2 max-w-2xl text-sm text-aura">
        Your pointer is locked to the game until you press Esc.
      </p>
      <div ref={startRef} className="mt-4 flex flex-wrap items-center gap-4">
        <Button data-testid="fight-start" onClick={() => start('survival')} disabled={running}>
          {phase === 'over' && kind === 'survival' ? 'Play again' : 'Start Survival'}
        </Button>
        <Button data-testid="fight-start-taming" onClick={() => start('taming')} disabled={running}>
          {phase === 'over' && kind === 'taming' ? 'Tame again' : 'Start Taming'}
        </Button>
        <p data-testid="fight-best" className="text-sm text-aura">
          Best:{' '}
          {best === null ? 'no waves survived yet' : `${best} ${best === 1 ? 'wave' : 'waves'}`}
        </p>
        <p data-testid="fight-tamed" className="text-sm text-aura">
          Tamed: {plural(tamedTotal, 'cat', 'cats')}
        </p>
      </div>
      <p role="status" aria-live="polite" className="mt-3 min-h-5 text-sm text-plasma">
        {phase === 'over' ? message : ''}
      </p>

      {running &&
        (kind === 'survival' ? snap : tameSnap) &&
        createPortal(
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={kind === 'survival' ? 'Fight a cat: Survival' : 'Fight a cat: Taming'}
            tabIndex={-1}
            data-testid="fight-overlay"
            data-xenocat-ignore
            data-mode={mode}
            data-kind={kind}
            data-phase={phase}
            onPointerDown={onOverlayPointerDown}
            className="fixed inset-0 z-[9998] select-none bg-void/85 outline-none"
          >
            <div className="flex flex-wrap items-center gap-6 p-4 text-sm font-semibold text-cream">
              {kind === 'survival' && snap && (
                <>
                  <p data-testid="fight-lives" data-lives={snap.lives}>
                    Lives: {snap.lives}
                  </p>
                  <p data-testid="fight-wave" data-wave={snap.wave}>
                    Wave {snap.wave}
                  </p>
                  <p data-testid="fight-score">Survived: {snap.score}</p>
                </>
              )}
              {kind === 'taming' && tameSnap && (
                <>
                  <p data-testid="fight-tamed-now">Tamed this game: {tameSnap.tamed.length}</p>
                  <div
                    role="progressbar"
                    aria-label="Taming"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(tameSnap.hold * 100)}
                    className="h-2 w-32 overflow-hidden rounded-full bg-void"
                  >
                    <div
                      className="h-full bg-plasma"
                      style={{ width: `${tameSnap.hold * 100}%` }}
                    />
                  </div>
                </>
              )}
              <p role="status" className="text-plasma">
                {message}
              </p>
              {mode === 'fallback' && phase === 'playing' && (
                <Button className="ml-auto" onClick={finish}>
                  End game
                </Button>
              )}
            </div>

            <div aria-hidden="true">
              {kind === 'taming' && tameSnap?.cat && (
                <div
                  key={tameSnap.cat.id}
                  data-cat-id={tameSnap.cat.id}
                  data-testid="fight-cat"
                  data-cat-type={tameSnap.cat.typeId}
                  data-doing={tameSnap.cat.doing}
                  className="absolute rounded-full"
                  style={{
                    // Where the cat was when React last drew it; the loop moves it on.
                    left: tameSnap.cat.x - size / 2,
                    top: tameSnap.cat.y - size / 2,
                    width: size,
                    height: size,
                    // A blinking cat is gone for a moment; a held one glows as it calms.
                    opacity: tameSnap.cat.doing === 'blink' ? 0.15 : 1,
                    boxShadow:
                      tameSnap.hold > 0
                        ? `0 0 0 3px rgba(255, 255, 255, ${0.2 + tameSnap.hold * 0.6})`
                        : undefined,
                  }}
                >
                  <FightCatSprite typeId={tameSnap.cat.typeId} size={size} />
                </div>
              )}
              {kind === 'survival' &&
                snap?.cats.map((cat) => (
                  <div
                    key={cat.id}
                    data-cat-id={cat.id}
                    data-testid="fight-cat"
                    data-cat-type={cat.typeId}
                    className="absolute"
                    style={{
                      left: cat.x - size / 2,
                      top: cat.y - size / 2,
                      width: size,
                      height: size,
                    }}
                  >
                    <FightCatSprite typeId={cat.typeId} size={size} />
                  </div>
                ))}
            </div>

            {phase === 'paused' && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="rounded-2xl border border-line bg-panel p-6 text-center">
                  <p className="font-display text-xl text-cream">Paused</p>
                  <p className="mt-2 text-sm text-aura">The cats wait for you.</p>
                  <div className="mt-4 flex justify-center gap-3">
                    <Button onClick={resume}>Resume</Button>
                    <Button onClick={finish}>End game</Button>
                  </div>
                </div>
              </div>
            )}

            {mode === 'locked' && phase === 'playing' && (
              <div aria-hidden="true">
                {Array.from({ length: MAX_DECOYS }, (_, i) => (
                  <div
                    key={i}
                    ref={(element) => {
                      decoyRefs.current[i] = element;
                    }}
                    className="pointer-events-none fixed left-0 top-0 origin-top-left"
                    style={{ opacity: 0 }}
                  >
                    <CursorShape kind="arrow" />
                  </div>
                ))}
                <div
                  ref={pointerRef}
                  data-testid="fight-pointer"
                  className="pointer-events-none fixed left-0 top-0 origin-top-left"
                  style={{ opacity: 0 }}
                >
                  <CursorShape kind="arrow" />
                </div>
              </div>
            )}
          </div>,
          document.body
        )}
    </section>
  );
}

// Redrawn every frame as the cats move; the sprite itself never changes.
const FightCatSprite = memo(function FightCatSprite({
  typeId,
  size,
}: {
  typeId: string;
  size: number;
}) {
  const type = catTypeById(typeId);
  if (!type) return null;
  return (
    <div className="xenocat-ready h-full w-full">
      <CatSprite
        palette={type.palette}
        look={type.look}
        pose="awake"
        size={size}
        art={catArt(type.id, 'awake')}
      />
    </div>
  );
});
