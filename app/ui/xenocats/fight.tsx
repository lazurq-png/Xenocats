'use client';

import { memo, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/app/ui/button';
import { useXenocats } from './cat-layer';
import { catArt } from './cat-art';
import { CatSprite } from './cat-sprite';
import { CAT_TYPES, catTypeById } from './cat-types';
import { CAT_CONFIG } from './config';
import { type CursorLook, MAX_DECOYS, type Vec } from './effects';
import { CursorShape, hideCursor, placeCursor, useXenocatCursor } from './fake-cursor';
import { type LockedPointer, createLockedPointer } from './locked-pointer';
import { PLAYER_SIZE, PlayerSprite, gunTransform } from './player-sprite';
import { shotFor } from './gun';
import {
  type Beam,
  type Facing,
  SURVIVAL_BEST_KEY,
  type Survival,
  type SurvivalSnapshot,
  bestScore,
  createGameClock,
  createSurvival,
  facingTowards,
  isWalkKey,
  walkDirection,
} from './survival';
import { type Taming, type TamingSnapshot, createTaming } from './taming';
import { getGuide, getServerGuide, recordStat, recordTamed, subscribeGuide } from './field-guide';

// Fight a cat, on the /cats page. Start asks for pointer lock: the browser hides the
// system pointer and the game owns the pointer's position, so the cats attack that
// pointer itself (locked-pointer.ts). Esc releases the lock and ends the game;
// losing it any other way (another tab, another window) pauses it. Where pointer
// lock is refused or missing, the game runs on the page's own pointer instead.
//
// Two games: Survival (survival.ts), where a ranger walked with WASD beams cats home
// at the crosshair, and Taming (taming.ts), where one cat at a time dodges the
// pointer and holding still on it for 2 s tames it, into a collection kept in
// localStorage.
//
// In Survival the ranger and the crosshair are both positions a cat's attack can
// move (locked-pointer.ts, one each): WASD walks the one, the mouse moves the other,
// and every attack hits both.

type Mode = 'locked' | 'fallback';
type Phase = 'idle' | 'playing' | 'paused' | 'over';
type Kind = 'survival' | 'taming';

type Game = {
  clock: ReturnType<typeof createGameClock>;
  mode: Mode;
} & (
  | { kind: 'survival'; survival: Survival; player: LockedPointer; aim: LockedPointer }
  | { kind: 'taming'; taming: Taming; pointer: LockedPointer | null }
);

type Departure = { id: number; typeId: string; x: number; y: number };

/** The ranger never grows more than this under a cat's attack (Giant would be 4×). */
const MAX_PLAYER_SCALE = 2;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

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

/** Draws something centred on its element (the ranger, the crosshair) and its decoys. */
function placeWithDecoys(
  element: HTMLElement | null,
  decoys: readonly (HTMLElement | null)[],
  look: CursorLook
) {
  if (element) placeCursor(element, look, look);
  const spots = look.decoys ?? [];
  decoys.forEach((decoy, i) => {
    if (!decoy) return;
    if (i < spots.length) placeCursor(decoy, spots[i], look);
    else hideCursor(decoy);
  });
}

/** A beam drawn at its head, along its flight, at its size. */
const beamTransform = (beam: Beam) =>
  `translate3d(${beam.x}px, ${beam.y}px, 0) rotate(${Math.atan2(beam.vy, beam.vx)}rad) scale(${beam.scale})`;

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
  const [pose, setPose] = useState<{ facing: Facing; walking: boolean }>({
    facing: 'e',
    walking: false,
  });
  const [departures, setDepartures] = useState<Departure[]>([]);
  // Read on every render, so what a game just wrote shows at once.
  const best = useSyncExternalStore(subscribeBest, readBest, () => null);
  const guide = useSyncExternalStore(subscribeGuide, getGuide, getServerGuide);
  const tamedTotal = Object.values(guide.tamed).reduce((sum, count) => sum + count, 0);
  const [message, setMessage] = useState('');
  const gameRef = useRef<Game | null>(null);
  const phaseRef = useRef<Phase>('idle');
  const pointerRef = useRef<HTMLDivElement>(null);
  const decoyRefs = useRef<(HTMLDivElement | null)[]>([]);
  const playerRef = useRef<HTMLDivElement>(null);
  const playerDecoyRefs = useRef<(HTMLDivElement | null)[]>([]);
  const gunRef = useRef<HTMLDivElement>(null);
  const crosshairRef = useRef<HTMLDivElement>(null);
  const crosshairDecoyRefs = useRef<(HTMLDivElement | null)[]>([]);
  const startRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  // False once the section has gone: a lock request still pending then gives up.
  const mountedRef = useRef(true);
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
    setDepartures([]);
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

  // The fake cursor gives way to the game's own: the arrow under pointer lock, the
  // crosshair in Survival.
  const hidesCursor = (game: Game) => game.kind === 'survival' || game.mode === 'locked';

  const begin = (game: Game) => {
    gameRef.current = game;
    shownRef.current = '';
    setMode(game.mode);
    setKind(game.kind);
    setDepartures([]);
    if (game.kind === 'survival') setSnap(game.survival.snapshot());
    else setTameSnap(game.taming.snapshot(0));
    cursor.hide(hidesCursor(game));
    const stop = game.mode === 'locked' ? 'Press Esc to stop.' : 'Press Esc or End game to stop.';
    setMessage(
      game.kind === 'survival'
        ? `The cats are coming. Walk with WASD and aim: your beam fires by itself. ${stop}`
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
    if (!mountedRef.current) {
      if (locked) document.exitPointerLock();
      return;
    }
    const viewport = viewportSize();
    const at: Vec = cursor.position() ?? { x: viewport.width / 2, y: viewport.height / 2 };
    const clock = createGameClock(performance.now());
    const mode: Mode = locked ? 'locked' : 'fallback';
    const options = { random: cursor.random, types: CAT_TYPES, viewport, now: 0 };
    const position = (start: Vec) =>
      createLockedPointer({ viewport, start, random: cursor.random });
    begin(
      kind === 'survival'
        ? {
            clock,
            mode,
            kind,
            survival: createSurvival(options),
            player: position({ x: viewport.width / 2, y: viewport.height / 2 }),
            aim: position(at),
          }
        : {
            clock,
            mode,
            kind,
            taming: createTaming(options),
            pointer: locked ? position(at) : null,
          }
    );
  };

  const resume = async () => {
    const game = gameRef.current;
    if (!game || phaseRef.current !== 'paused') return;
    if (game.mode === 'locked') {
      const locked = await requestLock();
      if (!mountedRef.current) {
        if (locked) document.exitPointerLock();
        return;
      }
      if (!locked) {
        // Refused this time: carry on with the page's pointer.
        game.mode = 'fallback';
        if (game.kind === 'taming') game.pointer = null;
        setMode('fallback');
      }
    }
    game.clock.resume(performance.now());
    cursor.hide(hidesCursor(game));
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
        recordStat(cat.typeId, 'met');
      }
    };

    const moveCats = (list: readonly { id: number; x: number; y: number }[]) => {
      const elements = dialogRef.current?.querySelectorAll<HTMLElement>('[data-cat-id]') ?? [];
      for (const element of elements) {
        const cat = list.find((c) => String(c.id) === element.dataset.catId);
        if (cat) placeCat(element, cat);
      }
    };

    const moveBeams = (list: readonly Beam[]) => {
      const elements = dialogRef.current?.querySelectorAll<HTMLElement>('[data-beam-id]') ?? [];
      for (const element of elements) {
        const beam = list.find((b) => String(b.id) === element.dataset.beamId);
        // A falling or bouncing beam turns as it flies.
        if (beam) element.style.transform = beamTransform(beam);
      }
    };

    // Survival's input: the walk keys held. The gun fires by itself.
    const held = new Set<string>();
    let shown: { facing: Facing; walking: boolean } | null = null;
    // Without pointer lock the aim moves by how far the page's pointer moved.
    let lastClient: Vec | null = cursor.position();
    let lastNow = game.clock.now(performance.now());

    const playSurvival = (
      now: number,
      game: Extract<Game, { kind: 'survival' }>
    ): SurvivalSnapshot => {
      const dt = Math.max(now - lastNow, 0) / 1000;
      const way = walkDirection(held);
      const speed = game.survival.config.playerSpeed * dt;
      if (way.x !== 0 || way.y !== 0) game.player.move(way.x * speed, way.y * speed);

      const body = game.player.frame(now);
      const look = game.aim.frame(now);
      const player = { x: body.x, y: body.y };
      const aim = { x: look.x, y: look.y };
      // The ranger's attack reaches its gun too (gun.ts): null while it is jammed.
      const shot = shotFor(
        game.player.activeEffectId(now),
        { ...body, scale: Math.min(body.scale, MAX_PLAYER_SCALE) },
        aim,
        cursor.random
      );
      if (shot) game.survival.fire(now, shot.from, shot.to, shot.style);
      const { touched, pounced, beamed } = game.survival.tick(
        now,
        player,
        CAT_CONFIG.maxCats - cats.count()
      );

      // Every attack hits the ranger and the crosshair alike; one effect at a time
      // on each, but a cat touching during another's effect still costs a life.
      for (const cat of [...touched, ...pounced]) {
        const type = catTypeById(cat.typeId);
        if (!type) continue;
        const hitPlayer = game.player.attack(type.effect, cat, now);
        const hitAim = game.aim.attack(type.effect, cat, now);
        if (hitPlayer || hitAim) cats.sound(type.id, 'attack');
      }
      for (const cat of beamed) cats.sound(cat.typeId, 'purr');
      if (beamed.length > 0) setDepartures((list) => [...list, ...beamed]);

      const snapshot = game.survival.snapshot();
      // An attack that did not end the game was survived.
      if (snapshot.status === 'playing') {
        for (const cat of [...touched, ...pounced]) recordStat(cat.typeId, 'survived');
      }

      placeWithDecoys(playerRef.current, playerDecoyRefs.current, {
        ...body,
        scale: Math.min(body.scale, MAX_PLAYER_SCALE),
      });
      placeWithDecoys(crosshairRef.current, crosshairDecoyRefs.current, look);
      const angle = Math.atan2(aim.y - player.y, aim.x - player.x);
      if (gunRef.current) gunRef.current.style.transform = gunTransform(angle);
      if (playerRef.current)
        playerRef.current.dataset.effect = game.player.activeEffectId(now) ?? '';
      if (crosshairRef.current) {
        crosshairRef.current.dataset.effect = game.aim.activeEffectId(now) ?? '';
      }
      const facing = facingTowards(player, aim);
      const walking = way.x !== 0 || way.y !== 0;
      if (facing !== shown?.facing || walking !== shown.walking) {
        shown = { facing, walking };
        setPose(shown);
      }
      return snapshot;
    };

    let frameId = 0;
    const loop = () => {
      if (phaseRef.current !== 'playing') {
        // Nothing stays held through a pause.
        held.clear();
      } else {
        const now = game.clock.now(performance.now());
        if (game.kind === 'taming') {
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
              else hideCursor(decoy);
            });
          } else {
            const viewport = viewportSize();
            at = cursor.position() ?? { x: viewport.width / 2, y: viewport.height / 2 };
          }
          const tamed = game.taming.tick(now, at, CAT_CONFIG.maxCats - cats.count());
          if (tamed) {
            recordTamed(tamed);
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
          const snapshot = playSurvival(now, game);
          hearArrivals(snapshot.cats);
          moveCats(snapshot.cats);
          moveBeams(snapshot.beams);
          const { status, lives, wave, score } = snapshot;
          const ids = snapshot.cats.map((cat) => `${cat.id}${cat.attackAt === null ? '!' : ''}`);
          const beams = snapshot.beams.map((beam) => beam.id);
          const key = `${status}|${lives}|${wave}|${score}|${ids.join(',')}|${beams.join(',')}`;
          if (key !== shownRef.current) {
            shownRef.current = key;
            setSnap(snapshot);
          }
          if (snapshot.status === 'over') {
            finish();
            return;
          }
        }
        lastNow = now;
      }
      frameId = requestAnimationFrame(loop);
    };
    frameId = requestAnimationFrame(loop);

    const isLocked = () => game.mode === 'locked' && document.pointerLockElement === document.body;

    const onMouseMove = (event: MouseEvent) => {
      if (phaseRef.current !== 'playing') return;
      if (game.kind === 'taming') {
        if (game.pointer && isLocked()) game.pointer.move(event.movementX, event.movementY);
        return;
      }
      if (isLocked()) {
        lastClient = null;
        game.aim.move(event.movementX, event.movementY);
        return;
      }
      const client = { x: event.clientX, y: event.clientY };
      if (lastClient) game.aim.move(client.x - lastClient.x, client.y - lastClient.y);
      lastClient = client;
    };
    let lockLostTimer = 0;
    const onLockChange = () => {
      // The game releasing the lock itself (it is over) is not a loss.
      if (phaseRef.current !== 'playing' || game.mode !== 'locked') return;
      if (document.pointerLockElement === document.body) return;
      // Esc leaves the page focused and visible; a tab or window switch does not.
      // Their blur and visibility events can arrive just after the lock is lost.
      lockLostTimer = window.setTimeout(() => {
        if (document.hasFocus() && document.visibilityState === 'visible') finish();
        else pause();
      }, 100);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        finish();
        return;
      }
      if (game.kind !== 'survival' || phaseRef.current !== 'playing') return;
      if (event.ctrlKey || event.metaKey || event.altKey || !isWalkKey(event.code)) return;
      // The arrow keys would scroll the page under the game.
      event.preventDefault();
      held.add(event.code);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      held.delete(event.code);
    };
    const onHidden = () => {
      if (document.visibilityState === 'hidden') pause();
    };
    const onResize = () => {
      if (game.kind === 'survival') {
        game.survival.resize(viewportSize());
        game.player.resize(viewportSize());
        game.aim.resize(viewportSize());
      } else {
        game.taming.resize(viewportSize());
        game.pointer?.resize(viewportSize());
      }
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('pointerlockchange', onLockChange);
    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', pause);
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(frameId);
      window.clearTimeout(lockLostTimer);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('pointerlockchange', onLockChange);
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', pause);
      window.removeEventListener('resize', onResize);
    };
  }, [running, cursor, cats, finish, pause]);

  // Leaving the page mid-game: give the pointer back.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (document.pointerLockElement) document.exitPointerLock();
      cursor.hide(false);
    };
  }, [cursor]);

  // The game is a modal dialog: Tab and Shift+Tab stay inside it (on its buttons,
  // or on the dialog itself when it has none, as under pointer lock).
  const onDialogKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== 'Tab') return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const buttons = Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled])'));
    if (buttons.length === 0) {
      event.preventDefault();
      dialog.focus();
      return;
    }
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === dialog)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const size = CAT_CONFIG.catSize;
  const half = PLAYER_SIZE / 2;

  return (
    <section
      aria-labelledby="fight-heading"
      className="mb-10 rounded-2xl border border-line bg-panel p-6"
    >
      <h2 id="fight-heading" className="font-display text-2xl font-semibold text-cream">
        Fight a cat
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-aura">
        <span className="font-semibold text-white">Survival.</span> Walk your ranger with WASD (or
        the arrow keys), aim with the mouse: the homing beam fires by itself, and a cat it hits is
        sent home. Cats come in waves, faster and more often each time, and chase you. Each one
        pounces a moment after it arrives, scrambling you, your aim and your gun; every cat that
        touches you costs one of 3 lives.
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
            onKeyDown={onDialogKeyDown}
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
                    data-pounced={cat.attackAt === null}
                    className={cat.attackAt === null ? 'xenocat-attacking absolute' : 'absolute'}
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
              {kind === 'survival' &&
                departures.map((cat) => (
                  <div
                    key={cat.id}
                    data-testid="fight-departure"
                    className="pointer-events-none absolute"
                    style={{
                      left: cat.x - size / 2,
                      top: cat.y - size,
                      width: size,
                      height: size * 1.5,
                    }}
                    onAnimationEnd={(event) => {
                      if (event.target !== event.currentTarget.lastElementChild) return;
                      setDepartures((list) => list.filter((d) => d.id !== cat.id));
                    }}
                  >
                    <div className="xenocat-beam-column absolute inset-x-2 bottom-0 top-0 rounded-full" />
                    <div
                      className="xenocat-beam-home absolute bottom-0 left-0"
                      style={{ width: size, height: size }}
                    >
                      <FightCatSprite typeId={cat.typeId} size={size} />
                    </div>
                  </div>
                ))}
              {kind === 'survival' &&
                snap?.beams.map((beam) => (
                  <div
                    key={beam.id}
                    data-beam-id={beam.id}
                    data-testid="fight-beam"
                    className="pointer-events-none fixed left-0 top-0 h-0 w-0 origin-top-left"
                    style={{
                      transform: beamTransform(beam),
                      opacity: beam.opacity,
                      filter:
                        [
                          beam.blur > 0 ? `blur(${beam.blur}px)` : '',
                          beam.tint ? `drop-shadow(0 0 4px ${beam.tint})` : '',
                        ]
                          .filter(Boolean)
                          .join(' ') || undefined,
                    }}
                  >
                    <div className="xenocat-beam absolute -left-6 -top-0.5 h-1 w-6 rounded-full" />
                  </div>
                ))}
            </div>

            {kind === 'survival' && (
              <div aria-hidden="true">
                {Array.from({ length: MAX_DECOYS }, (_, i) => (
                  <div
                    key={i}
                    ref={(element) => {
                      playerDecoyRefs.current[i] = element;
                    }}
                    className="pointer-events-none fixed left-0 top-0 h-0 w-0 origin-top-left"
                    style={{ opacity: 0 }}
                  >
                    <div className="absolute" style={{ left: -half, top: -half }}>
                      <PlayerSprite facing={pose.facing} walking={pose.walking} />
                    </div>
                  </div>
                ))}
                <div
                  ref={playerRef}
                  data-testid="fight-player"
                  data-facing={pose.facing}
                  data-walking={pose.walking}
                  className="pointer-events-none fixed left-0 top-0 h-0 w-0 origin-top-left"
                  style={{ opacity: 0 }}
                >
                  <div className="absolute" style={{ left: -half, top: -half }}>
                    <PlayerSprite facing={pose.facing} walking={pose.walking} gunRef={gunRef} />
                  </div>
                </div>
              </div>
            )}

            {kind === 'survival' && phase === 'playing' && (
              <div aria-hidden="true">
                {Array.from({ length: MAX_DECOYS }, (_, i) => (
                  <div
                    key={i}
                    ref={(element) => {
                      crosshairDecoyRefs.current[i] = element;
                    }}
                    className="pointer-events-none fixed left-0 top-0 h-0 w-0 origin-top-left"
                    style={{ opacity: 0 }}
                  >
                    <Crosshair />
                  </div>
                ))}
                <div
                  ref={crosshairRef}
                  data-testid="fight-crosshair"
                  className="pointer-events-none fixed left-0 top-0 h-0 w-0 origin-top-left"
                  style={{ opacity: 0 }}
                >
                  <Crosshair />
                </div>
              </div>
            )}

            {phase === 'paused' && (
              <div className="absolute inset-0 z-20 flex items-center justify-center">
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

            {kind === 'taming' && mode === 'locked' && phase === 'playing' && (
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

/** The aim: a 32 px ring and cross centred on its element. */
function Crosshair() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 32 32"
      className="absolute -left-4 -top-4 overflow-visible"
    >
      <g stroke="#c1e838" strokeWidth="2" fill="none" strokeLinecap="round">
        <circle cx="16" cy="16" r="10" />
        <path d="M16 1v8M16 23v8M1 16h8M23 16h8" />
      </g>
      <circle cx="16" cy="16" r="1.6" fill="#c1e838" />
    </svg>
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
