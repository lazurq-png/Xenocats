'use client';

import { memo, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Button } from '@/app/ui/button';
import { useXenocats } from './cat-layer';
import { catArt } from './cat-art';
import { CatSprite } from './cat-sprite';
import { CAT_TYPES, catTypeById } from './cat-types';
import { CAT_CONFIG } from './config';
import { type CursorLook, MAX_DECOYS, type Vec } from './effects';
import { hideCursor, placeCursor, useXenocatCursor } from './fake-cursor';
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
import { type Taming, type TamingSnapshot, createTaming, treatInfo } from './taming';
import { MovementPad } from './movement-pad-view';
import { getGuide, getServerGuide, recordStat, recordTamed, subscribeGuide } from './field-guide';

// Fight a cat, each game on a page of its own (fight-page.tsx): the page is the
// game, its play area filling the page while a game runs. Start asks for pointer
// lock: the browser hides the system pointer and the game owns the pointer's
// position, so the cats attack that pointer itself (locked-pointer.ts). Esc releases
// the lock and ends the game; losing it any other way (another tab, another window)
// pauses it, and leaving the page ends it. Where pointer lock is refused or missing,
// the game runs on the page's own pointer instead.
//
// Two games: Survival (/cats/survival, survival.ts), where a ranger walked with
// WASD beams cats home at the crosshair, and Taming (/cats/taming, taming.ts), where
// the same ranger, unarmed, carries treats to one cat at a time to tame it, into a
// collection kept in localStorage. Taming is played on touch screens too, walked
// with the movement pad (movement-pad-view.tsx); there the pointer is never locked.
//
// In Survival the ranger and the crosshair are both positions a cat's attack can
// move (locked-pointer.ts, one each): WASD walks the one, the mouse moves the other,
// and every attack hits both.

type Mode = 'locked' | 'fallback';
type Phase = 'idle' | 'playing' | 'paused' | 'over';
export type Kind = 'survival' | 'taming';

type Game = {
  clock: ReturnType<typeof createGameClock>;
  mode: Mode;
} & (
  | { kind: 'survival'; survival: Survival; player: LockedPointer; aim: LockedPointer }
  | { kind: 'taming'; taming: Taming; ranger: LockedPointer }
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
  kind,
  touch = false,
}: {
  kind: Kind;
  /** A touch screen: Taming is walked with the movement pad. */
  touch?: boolean;
}) {
  const cursor = useXenocatCursor();
  const cats = useXenocats();
  const [phase, setPhase] = useState<Phase>('idle');
  const [mode, setMode] = useState<Mode>('fallback');
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
  // The way the movement pad is held (zero when it is not).
  const padRef = useRef<Vec>({ x: 0, y: 0 });
  const onPad = useCallback((direction: Vec) => {
    padRef.current = direction;
  }, []);
  const playerRef = useRef<HTMLDivElement>(null);
  const playerDecoyRefs = useRef<(HTMLDivElement | null)[]>([]);
  const gunRef = useRef<HTMLDivElement>(null);
  const crosshairRef = useRef<HTMLDivElement>(null);
  const crosshairDecoyRefs = useRef<(HTMLDivElement | null)[]>([]);
  const startRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  // False once the section has gone: a lock request still pending then gives up.
  const mountedRef = useRef(true);
  // Cats move every frame, so the loop moves their elements itself; React renders
  // only when what it shows changes (a cat comes or goes, a life, a wave, the hold).
  const shownRef = useRef('');
  // Set from Start until the game begins: asking for the lock can take a second.
  const startingRef = useRef(false);

  const changePhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

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
      const tamed = game.taming.snapshot().tamed.length;
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

  // The fake cursor gives way to the game's own crosshair in Survival, and to the
  // locked pointer; in Taming's fallback it stays, so End game can be found (the
  // pointer itself plays no part in Taming).
  const hidesCursor = (game: Game) => game.kind === 'survival' || game.mode === 'locked';

  const begin = (game: Game) => {
    gameRef.current = game;
    shownRef.current = '';
    setMode(game.mode);
    setDepartures([]);
    if (game.kind === 'survival') setSnap(game.survival.snapshot());
    else setTameSnap(game.taming.snapshot());
    cursor.hide(hidesCursor(game));
    const stop =
      game.mode === 'locked'
        ? 'Press Esc to stop.'
        : touch
          ? 'Tap End game to stop.'
          : 'Press Esc or End game to stop.';
    setMessage(
      game.kind === 'survival'
        ? `The cats are coming. Walk with WASD and aim: your beam fires by itself. ${stop}`
        : `Walk with ${touch ? 'the pad' : 'WASD'} to a treat, then carry it to the cat. ${stop}`
    );
    changePhase('playing');
  };

  const start = async () => {
    if (startingRef.current || phaseRef.current === 'playing' || phaseRef.current === 'paused') {
      return;
    }
    startingRef.current = true;
    // A touch screen has no pointer to lock.
    const locked = touch ? false : await requestLock();
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
            ranger: position({ x: viewport.width / 2, y: viewport.height / 2 }),
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
    if (phase === 'playing' || phase === 'paused') areaRef.current?.focus();
    if (phase === 'over') startRef.current?.querySelector('button')?.focus();
  }, [phase]);

  // The game loop, and everything that can pause or end the game.
  const running = phase === 'playing' || phase === 'paused';

  // While a game runs its play area covers the page, so everything else is made
  // inert: keyboard focus cannot wander behind it (onto the header's links, or
  // Start). Only what this marked is unmarked again.
  useEffect(() => {
    if (!running) return;
    const area = areaRef.current;
    if (!area) return;
    const marked: Element[] = [];
    for (let node: Element = area; node.parentElement; node = node.parentElement) {
      for (const sibling of Array.from(node.parentElement.children)) {
        if (sibling === node || sibling.hasAttribute('inert')) continue;
        sibling.setAttribute('inert', '');
        marked.push(sibling);
      }
      if (node.parentElement === document.body) break;
    }
    return () => {
      for (const element of marked) element.removeAttribute('inert');
    };
  }, [running]);
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
      const elements = areaRef.current?.querySelectorAll<HTMLElement>('[data-cat-id]') ?? [];
      for (const element of elements) {
        const cat = list.find((c) => String(c.id) === element.dataset.catId);
        if (cat) placeCat(element, cat);
      }
    };

    const moveBeams = (list: readonly Beam[]) => {
      const elements = areaRef.current?.querySelectorAll<HTMLElement>('[data-beam-id]') ?? [];
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

    // Taming's ranger walks with the held keys, or the pad when none are held.
    const playTaming = (now: number, game: Extract<Game, { kind: 'taming' }>): TamingSnapshot => {
      const dt = Math.max(now - lastNow, 0) / 1000;
      const keys = walkDirection(held);
      const way = keys.x !== 0 || keys.y !== 0 ? keys : padRef.current;
      const speed = game.taming.config.rangerSpeed * dt;
      if (way.x !== 0 || way.y !== 0) game.ranger.move(way.x * speed, way.y * speed);
      const body = game.ranger.frame(now);
      const at = { x: body.x, y: body.y };
      const events = game.taming.tick(now, at, CAT_CONFIG.maxCats - cats.count());
      if (events.attack) {
        // Its attack lands on the ranger as it does in Survival.
        const type = catTypeById(events.attack.typeId);
        if (type && game.ranger.attack(type.effect, events.attack, now)) {
          cats.sound(type.id, 'attack');
        }
      }
      if (events.tamed) {
        recordTamed(events.tamed);
        cats.sound(events.tamed, 'purr');
        setMessage(`You tamed ${catTypeById(events.tamed)?.name ?? 'a cat'}!`);
      }
      placeWithDecoys(playerRef.current, playerDecoyRefs.current, {
        ...body,
        scale: Math.min(body.scale, MAX_PLAYER_SCALE),
      });
      if (playerRef.current) {
        playerRef.current.dataset.effect = game.ranger.activeEffectId(now) ?? '';
        playerRef.current.dataset.x = String(Math.round(at.x));
        playerRef.current.dataset.y = String(Math.round(at.y));
      }
      const walking = way.x !== 0 || way.y !== 0;
      // Facing the way it walks; standing, the way it last walked.
      const facing = walking
        ? facingTowards(at, { x: at.x + way.x, y: at.y + way.y })
        : (shown?.facing ?? 'e');
      if (facing !== shown?.facing || walking !== shown.walking) {
        shown = { facing, walking };
        setPose(shown);
      }
      return game.taming.snapshot();
    };

    let frameId = 0;
    const loop = () => {
      if (phaseRef.current !== 'playing') {
        // Nothing stays held through a pause.
        held.clear();
      } else {
        const now = game.clock.now(performance.now());
        if (game.kind === 'taming') {
          const snapshot = playTaming(now, game);
          hearArrivals(snapshot.cat ? [snapshot.cat] : []);
          moveCats(snapshot.cat ? [snapshot.cat] : []);
          const { cat, treats, carrying, tamed } = snapshot;
          const key = `${cat?.id}|${cat?.doing}|${treats.map((t) => t.id).join(',')}|${carrying}|${tamed.length}`;
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
      // The pointer plays no part in Taming.
      if (game.kind === 'taming') return;
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
      if (phaseRef.current !== 'playing') return;
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
        game.ranger.resize(viewportSize());
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

  const size = CAT_CONFIG.catSize;
  const half = PLAYER_SIZE / 2;

  return (
    <div>
      <h1 className="font-display text-4xl font-semibold text-cream md:text-[52px]">
        {kind === 'survival' ? 'Survival' : 'Taming'}
      </h1>
      {kind === 'survival' ? (
        <p className="mt-4 max-w-2xl text-sm text-aura">
          Walk your ranger with WASD (or the arrow keys), aim with the mouse: the homing beam fires
          by itself, and a cat it hits is sent home. Cats come in waves, faster and more often each
          time, and chase you. Each one pounces a moment after it arrives, scrambling you, your aim
          and your gun; every cat that touches you costs one of 3 lives.
        </p>
      ) : (
        <p className="mt-4 max-w-2xl text-sm text-aura">
          Walk your ranger with {touch ? 'the pad' : 'WASD (or the arrow keys)'} and pick up a treat
          (fish, catnip, yarn, milk); treats turn up here and there, and do not wait for long. One
          cat at a time: while you carry nothing it keeps away, each kind in its own way, and
          attacks you from a distance. Carry a treat and it comes to you: give it the treat, and the
          cat is tamed.
        </p>
      )}
      {!touch && (
        <p className="mt-2 max-w-2xl text-sm text-aura">
          Your pointer is locked to the game until you press Esc.
        </p>
      )}
      <div ref={startRef} className="mt-4 flex flex-wrap items-center gap-4">
        {kind === 'survival' ? (
          <>
            <Button data-testid="fight-start" onClick={() => start()} disabled={running}>
              {phase === 'over' ? 'Play again' : 'Start Survival'}
            </Button>
            <p data-testid="fight-best" className="text-sm text-aura">
              Best:{' '}
              {best === null ? 'no waves survived yet' : `${best} ${best === 1 ? 'wave' : 'waves'}`}
            </p>
          </>
        ) : (
          <>
            <Button data-testid="fight-start-taming" onClick={() => start()} disabled={running}>
              {phase === 'over' ? 'Tame again' : 'Start Taming'}
            </Button>
            <p data-testid="fight-tamed" className="text-sm text-aura">
              Tamed: {plural(tamedTotal, 'cat', 'cats')}
            </p>
          </>
        )}
      </div>
      <p role="status" aria-live="polite" className="mt-3 min-h-5 text-sm text-plasma">
        {phase === 'over' ? message : ''}
      </p>

      {running && (kind === 'survival' ? snap : tameSnap) && (
        // The play area: the whole page while a game runs, the HUD along its top.
        <div
          ref={areaRef}
          tabIndex={-1}
          data-testid="fight-area"
          data-xenocat-ignore
          data-mode={mode}
          data-kind={kind}
          data-phase={phase}
          className="fixed inset-0 z-[9998] select-none bg-void outline-none"
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
                <p data-testid="fight-carrying" data-carrying={tameSnap.carrying ?? ''}>
                  Carrying:{' '}
                  {tameSnap.carrying ? (
                    <>
                      <span aria-hidden="true">{treatInfo(tameSnap.carrying).emoji}</span>{' '}
                      {treatInfo(tameSnap.carrying).name}
                    </>
                  ) : (
                    'nothing'
                  )}
                </p>
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
                  // A blinking cat is gone for a moment; one coming for a treat glows.
                  opacity: tameSnap.cat.doing === 'blink' ? 0.15 : 1,
                  boxShadow:
                    tameSnap.cat.doing === 'coming'
                      ? '0 0 0 3px rgba(193, 232, 56, 0.6)'
                      : undefined,
                }}
              >
                <FightCatSprite typeId={tameSnap.cat.typeId} size={size} />
              </div>
            )}
            {kind === 'taming' &&
              tameSnap?.treats.map((treat) => (
                // Emoji for now: placeholders until the treats get artwork of their own.
                <div
                  key={treat.id}
                  data-testid="fight-treat"
                  data-kind={treat.kind}
                  data-x={Math.round(treat.x)}
                  data-y={Math.round(treat.y)}
                  className="absolute flex items-center justify-center rounded-full bg-panel/80 text-xl ring-1 ring-plasma/50"
                  style={{ left: treat.x - 18, top: treat.y - 18, width: 36, height: 36 }}
                >
                  {treatInfo(treat.kind).emoji}
                </div>
              ))}
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

          {/* The ranger: armed in Survival, empty-handed in Taming. */}
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
                  <PlayerSprite
                    facing={pose.facing}
                    walking={pose.walking}
                    armed={kind === 'survival'}
                  />
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
                <PlayerSprite
                  facing={pose.facing}
                  walking={pose.walking}
                  armed={kind === 'survival'}
                  gunRef={gunRef}
                />
              </div>
            </div>
          </div>

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

          {touch && kind === 'taming' && phase === 'playing' && (
            <MovementPad onDirection={onPad} className="fixed bottom-8 left-8 z-10" />
          )}
        </div>
      )}
    </div>
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
