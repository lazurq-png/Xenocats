'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Button } from '@/app/ui/button';
import {
  type Arena,
  ARENA_CONFIG,
  type ArenaOutcome,
  BLADE_RADIUS,
  createArena,
  runLengthConfig,
} from './arena';
import { HERO_BODY_SVGS, HERO_TOOL_SVGS, PATCH_SVG, PICKUP_SVG, VARIETY_SVG } from './arena-art';
import { DRAWN_DIRECTIONS, directionOfAngle, facesAway, spriteOf } from './hero-direction';
import {
  type Choice,
  MAX_WEAPON_LEVEL,
  WEAPONS,
  type WeaponId,
  describeChoice,
  evolutionText,
  fusionText,
} from './arsenal';
import {
  type AimMode,
  RUN_LENGTHS,
  type RunLength,
  bestOf,
  clockText,
  readAim,
  readBest,
  readGraphics,
  readGraphicsAuto,
  readLength,
  subscribeAim,
  subscribeGraphics,
  subscribeLength,
  writeBest,
  writeGraphics,
  writeGraphicsAuto,
  writeLength,
} from './arena-storage';
import { catArt } from './cat-art';
import { CAT_TYPES } from './cat-types';
import { recordStat } from './field-guide';
import { createFrameGuard } from './frame-guard';
import { MovementPad } from './movement-pad-view';
import {
  CHARACTERS,
  type CharacterId,
  MILESTONES,
  type MilestoneId,
  unlockedBy,
  applyRun,
  hasCharacter,
  readProgress,
  runConfig,
  writeProgress,
} from './progression';
import { ProgressionPanel, useProgress } from './progression-view';
import { createRandom, freshSeed } from './random';
import { CROWD_ARSENAL, FUSION_START, PICKUPS_HOOK_CHANCE, parseTestHooks } from './test-hooks';
import { GameSettings } from './game-settings';
import { PauseSummary } from './pause-summary';
import {
  AUTO_JUDGE_FROM_MS,
  AUTO_JUDGE_UNTIL_MS,
  type Graphics,
  pixelRatioFor,
  shouldGoLight,
} from './graphics';
import { tierStyle } from './item-tier';
import { type SoundPlayer, sharedSoundPlayer, soundsFor } from './sounds';
import { SCHEDULE, VARIETIES, type VarietyId } from './varieties';
import { PLAYER_KEYS, isWalkKey, walkDirection } from './walking';
import type { Vec } from './effects';

// Survival, the arena (arena.ts), drawn on a canvas that fills the page while a run
// lasts. The simulation runs in fixed steps, as many each frame as the time that
// passed asks for; the canvas is drawn once a frame, the cats from bitmaps made
// once from their artwork. The HUD is text, and the run's state is also on the
// play area as data- attributes for the browser tests. The canvas and everything
// drawn on it are hidden from assistive technology.
//
// Each level pauses the run for a choice (arsenal.ts): a dialog of three or four,
// picked with 1–4, the arrow keys and Enter, or a tap; focus moves into it and back.
//
// Test hooks, read from the page's address when a run starts: `?seed=` fixes the
// random source, `?speed=` (up to 50) makes time pass that much faster, `?boss=`
// (seconds) brings a Mega Cat that early, besides the schedule's. `?fps=1` shows the
// frame time and cat count; `?crowd=N` starts a crowded, late-game run (test-hooks.ts).

type Screen = 'start' | 'playing' | 'choosing' | 'paused' | 'results';

/** How each weapon's shots are drawn. */
const SHOT_COLOR: Record<string, string> = {
  'cat-treats': '#fbbf24',
  banquet: '#fbbf24',
  'spray-bottle': '#7dd3fc',
  monsoon: '#38bdf8',
  'yarn-ball': '#f472b6',
  'yarn-apocalypse': '#ec4899',
  hairball: '#a8865b',
  'bottomless-saucer': '#f5f0e0',
  'bath-tub': '#7dd3fc',
  jacuzzi: '#38bdf8',
};

/** How long an evolution's announcement stays, ms. */
const NOTICE_MS = 5000;

/** Cats drawn this size, px. */
const CAT_SIZE = 44;
const HERO_SIZE = 56;
/** The floor's tiles, px. */
const TILE = 96;
/** A game step more than this behind is dropped: the game slows rather than freezing. */
const MAX_STEPS_PER_FRAME = 240;
/** Never more than this many sounds start within `SOUND_WINDOW_MS`. */
const MAX_SOUNDS = 3;
const SOUND_WINDOW_MS = 300;

const FRAME_GUARD = { floorFps: 40, resumeFps: 50, smoothing: 0.1 };

type Flash = { x: number; y: number; until: number };

type Hud = {
  time: number;
  resolve: number;
  maxResolve: number;
  sentHome: number;
  cats: number;
  heroX: number;
  heroY: number;
  effect: string | null;
  /** The Mega Cat on the field, if one is: how homesick, of how much. */
  boss: { homesickness: number; limit: number } | null;
  level: number;
  xp: number;
  xpToNext: number;
  weapons: string;
  /** The frame time, ms (smoothed), for `?fps=1`. */
  frameMs: number;
  /** How many elites are winding up an attack, and how many have begun in the run. */
  windUps: number;
  windUpsBegun: number;
  bossWindUp: string;
  bossWindUpsBegun: number;
  pickups: number;
  pickupsTaken: number;
  lastPickup: string;
  /** Where the crosshair is on the screen ("x,y"), or "" without one. */
  crosshair: string;
  /** The camera's zoom: arena px to a screen px (1 on a desktop, more on a phone). */
  zoom: number;
  /** Each Keeper's Resolve, and whether he is down (co-op: two). */
  heroes: {
    /** Which of the eight directions he faces. */
    facing: string;
    resolve: number;
    maxResolve: number;
    down: boolean;
    backIn: number;
    x: number;
    y: number;
  }[];
};

const LENGTH_WORDS: Record<RunLength, string> = { 5: 'Five', 10: 'Ten', 15: 'Fifteen' };

const OUTCOME_TEXT: Record<ArenaOutcome, string> = {
  spent: 'His Resolve is spent. The cats remain.',
  'gave-up': 'He has given up. The cats remain.',
  goal: 'The night is survived. The cats remain.',
};

/** A sound for a cat of any kind: a variety sounds like the first xenocat type. */
const typeOf = (type: number) => CAT_TYPES[type] ?? CAT_TYPES[0];

/** The direction a Keeper is drawn facing: his aim; a downed one lies on his side, as ever. */
const viewDirection = (h: { down: boolean; facing: number; lookAngle: number }) =>
  h.down ? (h.facing < 0 ? 'W' : 'E') : directionOfAngle(h.lookAngle);

/** A bitmap of `src`, `size` px square, drawn once; null until it has loaded. */
function bitmapOf(src: string, size: number, onReady: () => void): () => HTMLCanvasElement | null {
  let ready: HTMLCanvasElement | null = null;
  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    canvas.getContext('2d')?.drawImage(image, 0, 0, size, size);
    ready = canvas;
    onReady();
  };
  image.src = src;
  return () => ready;
}

function subscribeBest(onChange: () => void) {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
}

export default function ArenaGame({ touch = false }: { touch?: boolean }) {
  const [screen, setScreen] = useState<Screen>('start');
  const [hud, setHud] = useState<Hud | null>(null);
  const [showFps, setShowFps] = useState(false);
  const [outcome, setOutcome] = useState<ArenaOutcome | null>(null);
  // The finished run's numbers, kept for the results screen.
  const [result, setResult] = useState<{
    time: number;
    sentHome: number;
    earned: number;
    reached: MilestoneId[];
    /** In co-op: each Keeper, who he went out as, what he carried, how he ended. */
    keepers: {
      name: string;
      weapons: { id: WeaponId; name: string; level: number }[];
      down: boolean;
    }[];
  } | null>(null);
  // A level-up's choices, while the run waits for one.
  const [choices, setChoices] = useState<Choice[] | null>(null);
  // The level the waiting choice is for (several can wait after one gem).
  const [choiceLevel, setChoiceLevel] = useState(2);
  // One Keeper, or two at one keyboard; player 2's character; whose choice it is.
  const [players, setPlayers] = useState<1 | 2>(1);
  const [secondCharacter, setSecondCharacter] = useState<CharacterId>('keeper');
  const [chooser, setChooser] = useState(0);
  // How many Keepers the run in progress has (the refs are for the loop).
  const [runPlayers, setRunPlayers] = useState<1 | 2>(1);
  const progress = useProgress();
  // An evolution's announcement, for a few seconds.
  const [notice, setNotice] = useState<string | null>(null);
  const choiceRef = useRef<HTMLDivElement>(null);
  // How long a run lasts: the lobby's choice, kept in the browser. The run in progress
  // (or just over) keeps the length it started with.
  const length = useSyncExternalStore(subscribeLength, readLength, (): RunLength => 5);
  const [runLength, setRunLength] = useState<RunLength>(5);
  const lengthRef = useRef<RunLength>(5);
  const best = useSyncExternalStore(
    subscribeBest,
    () => readBest(length),
    () => null
  );
  // Aiming with a crosshair: a computer's choice (a touch screen has no pointer).
  const storedAim = useSyncExternalStore(subscribeAim, readAim, (): AimMode => 'auto');
  const aimMode: AimMode = touch ? 'auto' : storedAim;
  // Full graphics, or light (graphics.ts): drawn by the loop through a ref, so a change
  // in the pause menu takes hold at once.
  const graphics = useSyncExternalStore(subscribeGraphics, readGraphics, (): Graphics => 'full');
  const graphicsRef = useRef<Graphics>(graphics);
  const aimRef = useRef<AimMode>(aimMode);
  // Where the mouse is on the screen, while a run lasts (null until it moves).
  const pointerRef = useRef<Vec | null>(null);
  useEffect(() => {
    aimRef.current = aimMode;
  }, [aimMode]);
  useEffect(() => {
    graphicsRef.current = graphics;
    // The canvas is sized at the pixel ratio the setting gives: size it again.
    window.dispatchEvent(new Event('resize'));
  }, [graphics]);
  const arenaRef = useRef<Arena | null>(null);
  const [pausedState, setPausedState] = useState<ReturnType<Arena['state']> | null>(null);
  const screenRef = useRef<Screen>('start');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const pauseRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLElement>(null);
  const padRef = useRef<Vec>({ x: 0, y: 0 });
  const speedRef = useRef(1);
  // `?crowd=` and `?elite=`: the cats come whatever the frame rate (the frame guard is off), so a
  // test's run does not depend on how busy the machine is.
  const crowdRef = useRef(false);
  // Who went out, and what the run found for the codex.
  const characterRef = useRef<CharacterId>('keeper');
  const secondRef = useRef<CharacterId | null>(null);
  const foundRef = useRef(new Set<string>());
  const playerRef = useRef<SoundPlayer | null>(null);
  const onPad = useCallback((direction: Vec) => {
    padRef.current = direction;
  }, []);

  const show = useCallback((next: Screen) => {
    screenRef.current = next;
    setScreen(next);
    // The pause menu shows the run as it stood when it paused.
    if (next === 'paused') setPausedState(arenaRef.current?.state() ?? null);
  }, []);

  const finish = useCallback(
    (how: ArenaOutcome) => {
      const arena = arenaRef.current;
      if (!arena) return;
      const time = Math.min(arena.state().time, arena.config.timeGoalMs);
      writeBest(bestOf(readBest(lengthRef.current), time), lengthRef.current);
      const { sentHome, level } = arena.state();
      const after = applyRun(readProgress(), {
        timeMs: time,
        sentHome,
        level,
        found: [...foundRef.current],
      });
      writeProgress(after.progress);
      const characters = [characterRef.current, secondRef.current ?? 'keeper'];
      setResult({
        time,
        sentHome,
        earned: after.earned,
        reached: after.reached,
        keepers: arena.state().heroes.map((h, i) => ({
          name: CHARACTERS[characters[i]].name,
          weapons: h.weapons.map((w) => ({ id: w.id, name: WEAPONS[w.id].name, level: w.level })),
          down: h.down,
        })),
      });
      setOutcome(how);
      show('results');
    },
    [show]
  );

  const start = () => {
    const { seed, speed, boss, fps, crowd, elite, fusion, pickups } = parseTestHooks(
      window.location.search,
      freshSeed
    );
    const chosen = readLength();
    lengthRef.current = chosen;
    setRunLength(chosen);
    const lengthed = runLengthConfig(chosen);
    speedRef.current = speed;
    crowdRef.current = crowd !== null || elite;
    setShowFps(fps);
    playerRef.current ??= sharedSoundPlayer();
    // The click that started the run is the gesture sound needs.
    playerRef.current.unlock();
    const stored = readProgress();
    characterRef.current = stored.character;
    // Co-op is keyboard only: on a touch screen, one Keeper.
    secondRef.current =
      !touch && players === 2
        ? hasCharacter(stored, secondCharacter)
          ? secondCharacter
          : 'keeper'
        : null;
    foundRef.current = new Set();
    arenaRef.current = createArena({
      random: createRandom(seed),
      types: CAT_TYPES,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      config: {
        // His character, what the Tailor sold him, the weapons unlocked.
        ...runConfig(stored, ARENA_CONFIG, secondRef.current),
        ...lengthed,
        ...(elite ? { cats: { ...ARENA_CONFIG.cats, eliteShare: 1 } } : {}),
        ...(pickups ? { pickups: { ...ARENA_CONFIG.pickups, chance: PICKUPS_HOOK_CHANCE } } : {}),
        ...(fusion
          ? {
              startingWeapons: FUSION_START,
              startingLevel: MAX_WEAPON_LEVEL,
              startingChests: 1,
            }
          : {}),
        ...(boss === null
          ? {}
          : {
              schedule: {
                ...SCHEDULE,
                bosses: [boss, ...lengthed.schedule!.bosses].sort((a, b) => a - b),
              },
            }),
        ...(crowd === null
          ? {}
          : {
              escalation: [[0, crowd]] as [number, number][],
              // The arsenal sends cats home as fast as they come: refill the crowd quickly.
              arrivalShare: 40,
              // No level-up may stop a benchmark: gems worth nothing, chests out of reach.
              gems: { ...ARENA_CONFIG.gems, value: 0, eliteValue: 0 },
              chestReach: -1,
              startingWeapons: CROWD_ARSENAL,
              startingLevel: MAX_WEAPON_LEVEL,
              hero: { ...ARENA_CONFIG.hero, resolve: 1e9 },
            }),
      },
    });
    setOutcome(null);
    setNotice(null);
    setChooser(0);
    setRunPlayers(secondRef.current ? 2 : 1);
    setHud(null);
    show('playing');
  };

  const pause = useCallback(() => {
    if (screenRef.current === 'playing') show('paused');
  }, [show]);
  const resume = () => {
    if (screenRef.current === 'paused') show('playing');
  };
  const giveUp = () => {
    arenaRef.current?.giveUp();
    finish('gave-up');
  };

  /** Takes a level-up's choice; the run goes on, or the next level's choice comes. */
  const choose = useCallback(
    (index: number) => {
      const arena = arenaRef.current;
      if (!arena || screenRef.current !== 'choosing') return;
      arena.choose(index);
      const next = arena.choices();
      if (next) {
        setChoices([...next]);
        setChoiceLevel(arena.choiceLevel());
        setChooser(arena.chooser());
      } else {
        setChoices(null);
        show('playing');
      }
    },
    [show]
  );

  const running = screen === 'playing' || screen === 'choosing' || screen === 'paused';

  // Focus: into the play area when a run starts (and back after a choice), onto the
  // first choice at a level-up, onto Resume when paused, onto Play again when over.
  useEffect(() => {
    if (screen === 'playing') areaRef.current?.focus();
    if (screen === 'choosing') choiceRef.current?.querySelector('button')?.focus();
    if (screen === 'paused') pauseRef.current?.querySelector('button')?.focus();
    if (screen === 'results') resultsRef.current?.querySelector('button')?.focus();
  }, [screen, choices]);

  // While a run lasts its play area covers the page: everything else is inert, so
  // focus cannot wander behind it. Only what this marked is unmarked again.
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
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [notice]);

  // The run: input, the fixed-step loop, drawing, sounds.
  useEffect(() => {
    if (!running) return;
    const arena = arenaRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!arena || !canvas || !context) return;
    // A new run has no crosshair until the mouse moves in it: not the last run's.
    pointerRef.current = null;

    let dirty = true;
    const redraw = () => {
      dirty = true;
    };
    const sprites = CAT_TYPES.map((type) => {
      const art = catArt(type.id, 'awake');
      return art ? bitmapOf(art, CAT_SIZE * 2, redraw) : () => null;
    });
    // A boss wears a xenocat's face at a Mega Cat's size: drawn from a large
    // bitmap, made the first time that face is a boss's.
    const bossSprites = new Map<number, () => HTMLCanvasElement | null>();
    const bossSprite = (type: number) => {
      let sprite = bossSprites.get(type);
      if (!sprite) {
        const art = catArt(CAT_TYPES[type].id, 'awake');
        sprite = art ? bitmapOf(art, 256, redraw) : () => null;
        bossSprites.set(type, sprite);
      }
      return sprite();
    };
    // Until then a notice that matters (a boss, an evolution, a Keeper down or
    // back) is not covered by a xenocat's arrival.
    let importantUntil = 0;
    // The xenocat kinds announced this run: each is news once.
    const announced = new Set<number>();
    const important = (text: string) => {
      importantUntil = performance.now() + NOTICE_MS;
      setNotice(text);
    };
    // Each Keeper: his body in the five directions the art draws, and his tool.
    const svgUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    const heroSprites = [characterRef.current, secondRef.current ?? 'keeper'].map((id) => ({
      bodies: Object.fromEntries(
        DRAWN_DIRECTIONS.map((d) => [
          d,
          bitmapOf(svgUrl(HERO_BODY_SVGS[id][d]), HERO_SIZE * 2, redraw),
        ])
      ) as Record<(typeof DRAWN_DIRECTIONS)[number], () => HTMLCanvasElement | null>,
      tool: bitmapOf(svgUrl(HERO_TOOL_SVGS[id]), HERO_SIZE * 2, redraw),
    }));
    const twoPlayers = secondRef.current !== null;
    const titan = CAT_TYPES.findIndex((type) => type.id === 'titan-forest-cat');
    const varietySprites = Object.fromEntries(
      (Object.keys(VARIETIES) as VarietyId[]).map((id) => [
        id,
        bitmapOf(
          `data:image/svg+xml;charset=utf-8,${encodeURIComponent(VARIETY_SVG[id])}`,
          id === 'mega' ? 256 : 128,
          redraw
        ),
      ])
    ) as Record<VarietyId, () => HTMLCanvasElement | null>;

    const pickupSprites = Object.fromEntries(
      (['fish', 'magnet', 'bell'] as const).map((kind) => [
        kind,
        bitmapOf(
          `data:image/svg+xml;charset=utf-8,${encodeURIComponent(PICKUP_SVG[kind])}`,
          64,
          redraw
        ),
      ])
    ) as Record<'fish' | 'magnet' | 'bell', () => HTMLCanvasElement | null>;
    const patchSprites = {
      toy: bitmapOf(
        `data:image/svg+xml;charset=utf-8,${encodeURIComponent(PATCH_SVG.toy)}`,
        64,
        redraw
      ),
      box: bitmapOf(
        `data:image/svg+xml;charset=utf-8,${encodeURIComponent(PATCH_SVG.box)}`,
        64,
        redraw
      ),
    };
    const guard = createFrameGuard(FRAME_GUARD);
    const held = new Set<string>();
    const flashes: Flash[] = [];
    const met = new Set<number>();
    const sounds: number[] = [];
    let carry = 0;
    let runMs = 0;
    let windowMs = 0;
    let windowFrames = 0;
    // Whether this run may still switch itself to light: once ever, and not under a hook.
    let judging = !crowdRef.current && speedRef.current === 1 && !readGraphicsAuto();
    let last = performance.now();
    let lastHud = 0;
    let frameId = 0;

    const sound = (play: () => void) => {
      const now = performance.now();
      while (sounds.length > 0 && now - sounds[0] > SOUND_WINDOW_MS) sounds.shift();
      if (sounds.length >= MAX_SOUNDS) return;
      sounds.push(now);
      play();
    };

    const resize = () => {
      const ratio = pixelRatioFor(graphicsRef.current, window.devicePixelRatio);
      canvas.width = Math.round(window.innerWidth * ratio);
      canvas.height = Math.round(window.innerHeight * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      arena.resize({ width: window.innerWidth, height: window.innerHeight });
      dirty = true;
    };
    resize();

    const draw = (time: number) => {
      const state = arena.state();
      // Light graphics: no glows, no columns of light.
      const light = graphicsRef.current === 'light';
      // The shared camera: the screen shows the viewport times its zoom (the screen's
      // own zoom alone: 1 on a desktop, more on a phone; more again in co-op).
      const cam = arena.camera();
      const width = window.innerWidth * cam.zoom;
      const height = window.innerHeight * cam.zoom;
      const camX = cam.x - width / 2;
      const camY = cam.y - height / 2;
      context.save();
      context.scale(1 / cam.zoom, 1 / cam.zoom);
      context.fillStyle = '#070b14';
      context.fillRect(0, 0, width, height);
      // The floor: faint tiles that slide as he walks.
      context.strokeStyle = 'rgba(45, 47, 71, 0.55)';
      context.lineWidth = 1;
      context.beginPath();
      for (let x = -(((camX % TILE) + TILE) % TILE); x < width; x += TILE) {
        context.moveTo(x + 0.5, 0);
        context.lineTo(x + 0.5, height);
      }
      for (let y = -(((camY % TILE) + TILE) % TILE); y < height; y += TILE) {
        context.moveTo(0, y + 0.5);
        context.lineTo(width, y + 0.5);
      }
      context.stroke();

      // The Purring Cats' comfort: a faint warm halo as far as it reaches (to a
      // cat's edge), under everything else so the gems and chests stay clear.
      context.fillStyle = 'rgba(239, 227, 200, 0.07)';
      for (const cat of arena.cats()) {
        const soothes = cat.variety ? VARIETIES[cat.variety].soothes : undefined;
        if (!soothes) continue;
        const reach = soothes.radius + arena.config.cats.radius;
        const x = cat.x - camX;
        const y = cat.y - camY;
        if (x < -reach || y < -reach || x > width + reach || y > height + reach) continue;
        context.beginPath();
        context.arc(x, y, reach, 0, 2 * Math.PI);
        context.fill();
      }

      // The Thunderous Vacuum's reach, and the gems lying about.
      for (const zone of arena.zones()) {
        context.fillStyle = `rgba(157, 134, 255, ${0.1 + 0.04 * Math.sin(time / 180)})`;
        context.beginPath();
        context.arc(zone.x - camX, zone.y - camY, zone.radius, 0, 2 * Math.PI);
        context.fill();
      }
      for (const pickup of arena.pickups()) {
        const x = pickup.x - camX;
        const y = pickup.y - camY;
        if (x < -24 || y < -24 || x > width + 24 || y > height + 24) continue;
        const bitmap = pickupSprites[pickup.kind]();
        // Blinks in its last seconds, so it is seen going.
        if (pickup.until - state.time < 3000 && Math.floor(time / 150) % 2 === 0) continue;
        if (bitmap) context.drawImage(bitmap, x - 16, y - 16 + Math.sin(time / 200) * 2, 32, 32);
      }
      for (const gem of arena.gems()) {
        const x = gem.x - camX;
        const y = gem.y - camY;
        if (x < -8 || y < -8 || x > width + 8 || y > height + 8) continue;
        context.fillStyle = gem.value > 1 ? '#c1e838' : '#9d86ff';
        context.beginPath();
        context.moveTo(x, y - 6);
        context.lineTo(x + 4, y);
        context.lineTo(x, y + 6);
        context.lineTo(x - 4, y);
        context.fill();
      }

      // What the household weapons set down: puddles under, then the toys and boxes.
      for (const patch of arena.patches()) {
        const x = patch.x - camX;
        const y = patch.y - camY;
        if (
          x < -patch.radius * 2 ||
          y < -patch.radius * 2 ||
          x > width + patch.radius * 2 ||
          y > height + patch.radius * 2
        ) {
          continue;
        }
        if (patch.kind === 'puddle') {
          context.fillStyle = 'rgba(125, 211, 252, 0.22)';
          context.beginPath();
          context.ellipse(x, y, patch.radius, patch.radius * 0.7, 0, 0, 2 * Math.PI);
          context.fill();
          continue;
        }
        // A toy's squeak, faint: how far it carries; a box's own size.
        if (patch.kind === 'toy') {
          context.strokeStyle = `rgba(224, 224, 179, ${0.18 + 0.08 * Math.sin(time / 120)})`;
          context.lineWidth = 2;
          context.beginPath();
          context.arc(x, y, patch.radius, 0, 2 * Math.PI);
          context.stroke();
        }
        const bitmap = patchSprites[patch.kind]();
        const size = Math.max(patch.radius * 1.6, 36);
        if (bitmap) context.drawImage(bitmap, x - size / 2, y - size / 2, size, size);
      }
      // The Feather Wand's swings, fading, and the Hair Dryer's jets.
      for (const swing of arena.sweeps()) {
        const left = Math.max(swing.until - state.time, 0) / 240;
        context.fillStyle = `rgba(224, 224, 179, ${0.1 + 0.3 * left})`;
        context.beginPath();
        context.moveTo(swing.x - camX, swing.y - camY);
        context.arc(
          swing.x - camX,
          swing.y - camY,
          swing.reach,
          swing.angle - swing.half,
          swing.angle + swing.half
        );
        context.closePath();
        context.fill();
      }
      for (const jet of arena.jets()) {
        context.fillStyle = 'rgba(253, 186, 116, 0.13)';
        context.strokeStyle = 'rgba(253, 186, 116, 0.35)';
        context.lineWidth = 1.5;
        context.beginPath();
        context.moveTo(jet.x - camX, jet.y - camY);
        context.arc(
          jet.x - camX,
          jet.y - camY,
          jet.reach,
          jet.angle - jet.half,
          jet.angle + jet.half
        );
        context.closePath();
        context.fill();
        context.stroke();
      }

      // An elite's attack winding up: where it will land, filling as the moment nears.
      for (const warning of arena.telegraphs()) {
        const ex = warning.x - camX;
        const ey = warning.y - camY;
        const fill = 0.08 + 0.22 * warning.progress;
        context.fillStyle = `rgba(255, 99, 99, ${fill})`;
        context.strokeStyle = 'rgba(255, 99, 99, 0.85)';
        context.lineWidth = 2;
        if (warning.shape === 'line') {
          const angle = Math.atan2(warning.aimY - warning.y, warning.aimX - warning.x);
          context.save();
          context.translate(ex, ey);
          context.rotate(angle);
          context.fillRect(0, -warning.width / 2, warning.length, warning.width);
          context.strokeRect(0, -warning.width / 2, warning.length, warning.width);
          context.restore();
        } else {
          const cx = (warning.shape === 'ring' ? warning.x : warning.aimX) - camX;
          const cy = (warning.shape === 'ring' ? warning.y : warning.aimY) - camY;
          context.beginPath();
          context.arc(cx, cy, warning.radius, 0, 2 * Math.PI);
          context.fill();
          context.stroke();
        }
      }

      // The beams.
      context.strokeStyle = '#c1e838';
      if (!light) {
        context.shadowColor = '#c1e838';
        context.shadowBlur = 12;
      }
      context.lineWidth = 3;
      for (const beam of arena.beams()) {
        context.beginPath();
        context.moveTo(beam.from.x - camX, beam.from.y - camY);
        context.lineTo(beam.to.x - camX, beam.to.y - camY);
        context.stroke();
      }
      context.shadowBlur = 0;

      // The chests lying about.
      for (const chest of arena.chests()) {
        const x = chest.x - camX;
        const y = chest.y - camY;
        if (x < -20 || y < -20 || x > width + 20 || y > height + 20) continue;
        context.fillStyle = '#b8874f';
        context.fillRect(x - 12, y - 8, 24, 16);
        context.fillStyle = '#c1e838';
        context.fillRect(x - 3, y - 3, 6, 6);
      }

      // The cats; an elite ringed, a homesick one with its bar.
      for (const cat of arena.cats()) {
        const x = cat.x - camX;
        const y = cat.y - camY;
        // A variety is drawn at its own size; a xenocat at the cats' size. A boss
        // has a variety's size and a xenocat's face.
        const size = cat.variety ? cat.radius * 2.8 : CAT_SIZE;
        const half = size / 2;
        if (x < -size || y < -size || x > width + size || y > height + size) continue;
        const bitmap = !cat.variety
          ? sprites[cat.type]()
          : cat.type >= 0
            ? (bossSprite(cat.type) ?? sprites[cat.type]())
            : varietySprites[cat.variety]();
        if (bitmap) context.drawImage(bitmap, x - half, y - half, size, size);
        else {
          context.fillStyle = cat.variety ? '#8a8aa0' : CAT_TYPES[cat.type].palette.body;
          context.beginPath();
          context.arc(x, y, half * 0.7, 0, 2 * Math.PI);
          context.fill();
        }
        if (cat.elite && !cat.variety) {
          context.strokeStyle = '#9d86ff';
          context.lineWidth = 2;
          context.beginPath();
          context.arc(x, y, half + 2, 0, 2 * Math.PI);
          context.stroke();
        }
        if (cat.homesickness > 0) {
          context.fillStyle = 'rgba(7, 11, 20, 0.8)';
          context.fillRect(x - half, y - half - 6, size, 4);
          context.fillStyle = '#9d86ff';
          context.fillRect(
            x - half,
            y - half - 6,
            (size * Math.min(cat.homesickness, cat.limit)) / cat.limit,
            4
          );
        }
      }

      // The Laser Cats' shots.
      context.fillStyle = '#ef4444';
      for (const shot of arena.shots()) {
        context.beginPath();
        context.arc(shot.x - camX, shot.y - camY, 5, 0, 2 * Math.PI);
        context.fill();
      }

      // What his weapons fired, and the Can Opener's blades.
      for (const shot of arena.projectiles()) {
        const x = shot.x - camX;
        const y = shot.y - camY;
        if (x < -20 || y < -20 || x > width + 20 || y > height + 20) continue;
        context.fillStyle = SHOT_COLOR[shot.weapon] ?? '#e0e0b3';
        context.beginPath();
        context.arc(x, y, Math.max(shot.radius * 0.6, 3), 0, 2 * Math.PI);
        context.fill();
      }
      context.fillStyle = '#e0e0b3';
      for (const blade of arena.blades()) {
        context.save();
        context.translate(blade.x - camX, blade.y - camY);
        context.rotate(time / 90);
        context.fillRect(-BLADE_RADIUS, -4, BLADE_RADIUS * 2, 8);
        context.restore();
      }

      // Beamed home: a column of light where each one stood.
      for (let i = flashes.length - 1; i >= 0; i--) {
        const flash = flashes[i];
        const left = flash.until - time;
        if (left <= 0) {
          flashes.splice(i, 1);
          continue;
        }
        if (light) continue;
        context.fillStyle = `rgba(193, 232, 56, ${(left / 300) * 0.55})`;
        context.fillRect(flash.x - camX - 8, flash.y - camY - 60, 16, 70);
      }

      // The Matriarch.
      const matriarch = arena.matriarch();
      if (matriarch && titan >= 0) {
        const size = CAT_SIZE * 4;
        const bitmap = sprites[titan]();
        if (!light) {
          context.shadowColor = '#9d86ff';
          context.shadowBlur = 30;
        }
        if (bitmap) {
          context.drawImage(
            bitmap,
            matriarch.x - camX - size / 2,
            matriarch.y - camY - size / 2,
            size,
            size
          );
        }
        context.shadowBlur = 0;
      }

      // The Keepers, flickering while untouchable, faint under a veil; a downed one
      // lies on his side, pale. In co-op each is marked with his number.
      state.heroes.forEach((h, i) => {
        // He faces his aim (the crosshair, else the cat his weapon would fire at, else the
        // way he walks) in the nearest of eight directions; his tool points exactly at it.
        const direction = viewDirection(h);
        const { drawn, mirrored } = spriteOf(direction);
        const keeper = heroSprites[i].bodies[drawn]();
        const tool = heroSprites[i].tool();
        const x = h.x - camX;
        const y = h.y - camY;
        if (keeper && !(h.untouchable && !h.down && Math.floor(time / 90) % 2 === 0)) {
          context.save();
          context.globalAlpha = h.down ? 0.35 : h.effect === 'veil' ? 0.35 : 1;
          context.translate(x, y);
          if (h.down) context.rotate(Math.PI / 2);
          if (h.effect === 'freeze' && !h.down && !light) {
            context.shadowColor = '#7dd3fc';
            context.shadowBlur = 16;
          }
          const drawTool = () => {
            if (!tool || h.down) return;
            // The tool turns about his hand, pointing at the aim to the degree.
            context.save();
            context.translate(0, HERO_SIZE * 0.08);
            context.rotate(h.lookAngle);
            const k = (HERO_SIZE * 1.1) / 64;
            context.drawImage(tool, -10 * k, -32 * k, 64 * k, 64 * k);
            context.restore();
          };
          // Facing away, the tool is behind him.
          if (facesAway(direction)) drawTool();
          context.save();
          if (mirrored) context.scale(-1, 1);
          context.drawImage(keeper, -HERO_SIZE / 2, -HERO_SIZE / 2, HERO_SIZE, HERO_SIZE);
          context.restore();
          if (!facesAway(direction)) drawTool();
          context.restore();
        }
        if (twoPlayers) {
          context.fillStyle = i === 0 ? '#c1e838' : '#9d86ff';
          context.font = '600 14px sans-serif';
          context.textAlign = 'center';
          context.fillText(`P${i + 1}`, x, y - HERO_SIZE / 2 - 6);
        }
      });
      context.restore();

      // The crosshair, on the screen where the mouse points.
      const pointer = aimRef.current === 'crosshair' ? pointerRef.current : null;
      if (pointer) {
        context.save();
        context.strokeStyle = '#c1e838';
        context.lineWidth = 2;
        context.beginPath();
        context.arc(pointer.x, pointer.y, 11, 0, Math.PI * 2);
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          context.moveTo(pointer.x + dx * 6, pointer.y + dy * 6);
          context.lineTo(pointer.x + dx * 17, pointer.y + dy * 17);
        }
        context.stroke();
        context.restore();
      }
    };

    const frame = () => {
      frameId = requestAnimationFrame(frame);
      const now = performance.now();
      const real = Math.min(now - last, 250);
      last = now;
      if (screenRef.current !== 'playing') {
        held.clear();
        if (dirty) {
          draw(now);
          dirty = false;
        }
        return;
      }
      guard.record(real);
      runMs += real;
      // A machine below the floor, on average, in the first seconds gets light graphics,
      // once. Not under a hook that makes a run unlike a player's (speed, crowd, elite).
      if (judging && runMs >= AUTO_JUDGE_FROM_MS) {
        windowMs += real;
        windowFrames++;
        if (
          shouldGoLight({
            graphics: graphicsRef.current,
            switchedBefore: false,
            runMs,
            windowMs,
            windowFrames,
            floorFps: FRAME_GUARD.floorFps,
          })
        ) {
          judging = false;
          writeGraphicsAuto();
          writeGraphics('light');
          important(
            'This screen is struggling, so Graphics is set to Light. Change it back in the pause menu.'
          );
        } else if (runMs > AUTO_JUDGE_UNTIL_MS) judging = false;
      }
      carry += real * speedRef.current;
      // Alone, WASD and the arrow keys both walk him; in co-op, each player his own.
      const keys = walkDirection(held, twoPlayers ? PLAYER_KEYS[0] : undefined);
      const input = keys.x !== 0 || keys.y !== 0 ? keys : padRef.current;
      const input2 = twoPlayers ? walkDirection(held, PLAYER_KEYS[1]) : { x: 0, y: 0 };
      // Player 1 aims where the mouse points: the screen, back into the arena
      // under the camera (centred on it, `zoom` arena pixels to a screen pixel).
      const pointer = aimRef.current === 'crosshair' ? pointerRef.current : null;
      if (pointer) {
        const cam = arena.camera();
        arena.aimAt({
          x: cam.x + (pointer.x - window.innerWidth / 2) * cam.zoom,
          y: cam.y + (pointer.y - window.innerHeight / 2) * cam.zoom,
        });
      } else arena.aimAt(null);
      let steps = 0;
      while (carry >= arena.config.stepMs && steps < MAX_STEPS_PER_FRAME) {
        arena.step(input, crowdRef.current || guard.allowsSpawning(), input2);
        carry -= arena.config.stepMs;
        steps++;
      }
      if (steps === MAX_STEPS_PER_FRAME) carry = 0;

      const player = playerRef.current;
      let over: ArenaOutcome | null = null;
      const hits: number[] = [];
      for (const event of arena.drainEvents()) {
        if (event.kind === 'sent-home') {
          flashes.push({ x: event.x, y: event.y, until: now + 300 });
          if (player) sound(() => player.play(soundsFor(typeOf(event.type)).purr));
        } else if (event.kind === 'hero-hit') {
          if (event.type >= 0) hits.push(event.type);
          if (player) sound(() => player.play(soundsFor(typeOf(event.type)).attack));
        } else if (event.kind === 'boss') {
          important(`A giant ${CAT_TYPES[event.type].name} has come for the Keeper.`);
          if (player && titan >= 0) player.play(soundsFor(CAT_TYPES[titan]).wake);
        } else if (event.kind === 'xenocat') {
          // A xenocat is an event the first time its kind comes in a run (an
          // elite says so), never over a notice that matters more.
          if (!announced.has(event.type) && now >= importantUntil) {
            announced.add(event.type);
            setNotice(
              event.elite
                ? `${CAT_TYPES[event.type].name} has come, and it means it.`
                : `${CAT_TYPES[event.type].name} has come.`
            );
          }
        } else if (event.kind === 'chest') {
          if (player) sound(() => player.play(soundsFor(CAT_TYPES[0]).arrive));
        } else if (event.kind === 'evolution') {
          foundRef.current.add(event.to);
          important(evolutionText(event.from, event.to));
          if (player) player.play(soundsFor(CAT_TYPES[0]).wake);
        } else if (event.kind === 'fusion') {
          foundRef.current.add(event.to);
          important(fusionText(event.from, event.to));
          if (player) player.play(soundsFor(CAT_TYPES[0]).wake);
        } else if (event.kind === 'secret') {
          // Nothing is said: it is simply there. The codex remembers.
          foundRef.current.add(event.id);
        } else if (event.kind === 'downed') {
          important(
            `Player ${event.player + 1} is down. If the other lasts ${Math.round(arena.config.coop.reviveMs / 1000)} seconds, he will stand again.`
          );
          if (player) player.play(soundsFor(CAT_TYPES[0]).attack);
        } else if (event.kind === 'revived') {
          important(
            event.by === 'ally'
              ? `Player ${event.player + 1} stands again.`
              : twoPlayers
                ? `Second Wind. Player ${event.player + 1} is not finished.`
                : 'Second Wind. He is not finished.'
          );
          if (player) player.play(soundsFor(CAT_TYPES[0]).wake);
        } else if (event.kind === 'level-up') {
          if (player) sound(() => player.play(soundsFor(CAT_TYPES[0]).arrive));
        } else if (event.kind === 'matriarch' && titan >= 0 && player) {
          player.play(soundsFor(CAT_TYPES[titan]).wake);
        } else if (event.kind === 'over') {
          over = event.outcome;
        }
      }
      // An attack that did not end the run was survived (the field guide counts it).
      if (!over) for (const type of hits) recordStat(CAT_TYPES[type].id, 'survived');
      // Each type in the field guide, once a run, as it is first met.
      for (const cat of arena.cats()) {
        if (cat.type < 0 || met.has(cat.type)) continue;
        met.add(cat.type);
        recordStat(CAT_TYPES[cat.type].id, 'met');
      }
      draw(now);
      dirty = false;

      const state = arena.state();
      if (over || now - lastHud > 150) {
        lastHud = now;
        setHud({
          time: state.time,
          resolve: state.hero.resolve,
          maxResolve: state.hero.maxResolve,
          sentHome: state.sentHome,
          cats: state.cats,
          heroX: Math.round(state.hero.x),
          heroY: Math.round(state.hero.y),
          effect: state.hero.effect,
          boss: state.boss,
          level: state.level,
          xp: state.xp,
          xpToNext: state.xpToNext,
          weapons: state.weapons.map((w) => `${w.id}:${w.level}`).join(' '),
          frameMs: Math.round(10000 / (guard.fps() ?? 60)) / 10,
          windUps: state.windUps,
          windUpsBegun: state.windUpsBegun,
          bossWindUp: state.bossWindUp ?? '',
          bossWindUpsBegun: state.bossWindUpsBegun,
          pickups: state.pickups,
          pickupsTaken: state.pickupsTaken,
          lastPickup: state.lastPickup ?? '',
          crosshair:
            aimRef.current === 'crosshair' && pointerRef.current
              ? `${Math.round(pointerRef.current.x)},${Math.round(pointerRef.current.y)}`
              : '',
          zoom: Math.round(arena.camera().zoom * 100) / 100,
          heroes: state.heroes.map((h) => ({
            facing: viewDirection(h),
            resolve: h.resolve,
            maxResolve: h.maxResolve,
            down: h.down,
            backIn: h.backIn,
            x: Math.round(h.x),
            y: Math.round(h.y),
          })),
        });
      }
      if (over) finish(over);
      else if (arena.choices()) {
        // The run waits for a choice; the HUD shows the level it is for.
        carry = 0;
        setHud((before) =>
          before
            ? {
                ...before,
                level: state.level,
                xp: state.xp,
                xpToNext: state.xpToNext,
                weapons: state.weapons.map((w) => `${w.id}:${w.level}`).join(' '),
              }
            : before
        );
        setChoices([...arena.choices()!]);
        setChoiceLevel(arena.choiceLevel());
        setChooser(arena.chooser());
        show('choosing');
      }
    };
    frameId = requestAnimationFrame(frame);

    const onKeyDown = (event: KeyboardEvent) => {
      if (screenRef.current === 'choosing') {
        // 1–4 picks; the arrow keys move between the choices (Enter or Space picks).
        const number = Number(event.key);
        const buttons = Array.from(
          choiceRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? []
        );
        if (Number.isInteger(number) && number >= 1 && number <= buttons.length) {
          event.preventDefault();
          choose(number - 1);
        } else if (['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(event.key)) {
          event.preventDefault();
          const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
          const step = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1;
          buttons[(at + step + buttons.length) % buttons.length]?.focus();
        }
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        if (screenRef.current === 'playing') show('paused');
        else if (screenRef.current === 'paused') show('playing');
        return;
      }
      if (screenRef.current !== 'playing') return;
      if (event.ctrlKey || event.metaKey || event.altKey || !isWalkKey(event.code)) return;
      // The arrow keys would scroll the page under the game.
      event.preventDefault();
      held.add(event.code);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      held.delete(event.code);
    };
    const onPointer = (event: MouseEvent) => {
      pointerRef.current = { x: event.clientX, y: event.clientY };
    };
    const onHidden = () => {
      if (document.visibilityState === 'hidden') pause();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousemove', onPointer);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', pause);
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousemove', onPointer);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', pause);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onHidden);
    };
  }, [running, finish, pause, show, choose]);

  return (
    <div>
      <h1 className="font-display text-4xl font-semibold text-cream md:text-[52px]">Survival</h1>
      <p className="mt-4 max-w-2xl text-sm text-aura">
        The cats come from every side, and they do not stop coming. The Keeper does not hate them;
        he only wishes them home. His tools find them on their own: where you stand is everything.
        Each touch of a cat wears down his Resolve. Last for the whole run length, and the Matriarch
        herself will come for him.
      </p>
      <p className="mt-2 max-w-2xl text-sm text-aura">
        {touch
          ? 'Walk with the pad. Tap Pause to stop for a moment.'
          : 'Walk with WASD or the arrow keys. Esc pauses.'}
      </p>
      {!touch && (
        <fieldset className="mt-4 text-sm text-aura">
          <legend className="font-semibold text-cream">Keepers</legend>
          <div className="mt-1 flex flex-wrap gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="survival-players"
                data-testid="survival-players-1"
                checked={players === 1}
                onChange={() => setPlayers(1)}
                className="border-line bg-void text-aura focus:ring-aura"
              />
              One
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="survival-players"
                data-testid="survival-players-2"
                checked={players === 2}
                onChange={() => setPlayers(2)}
                className="border-line bg-void text-aura focus:ring-aura"
              />
              Two, at one keyboard: player 1 walks with WASD, player 2 with the arrow keys
            </label>
          </div>
          {players === 2 && (
            <label className="mt-2 flex flex-wrap items-center gap-2">
              Player 2 goes out as
              <select
                data-testid="survival-player2-character"
                value={secondCharacter}
                onChange={(event) => setSecondCharacter(event.target.value as CharacterId)}
                className="rounded-lg border-line bg-void py-1 text-sm text-cream focus:ring-aura"
              >
                {(Object.keys(CHARACTERS) as CharacterId[])
                  .filter((id) => hasCharacter(progress, id))
                  .map((id) => (
                    <option key={id} value={id}>
                      {CHARACTERS[id].name}
                    </option>
                  ))}
              </select>
            </label>
          )}
        </fieldset>
      )}
      <fieldset className="mt-4 text-sm text-aura" disabled={running}>
        <legend className="font-semibold text-cream">Run length</legend>
        <div className="mt-1 flex flex-wrap gap-4">
          {RUN_LENGTHS.map((minutes) => (
            <label key={minutes} className="flex items-center gap-2">
              <input
                type="radio"
                name="survival-length"
                data-testid={`survival-length-${minutes}`}
                checked={length === minutes}
                onChange={() => writeLength(minutes)}
                className="border-line bg-void text-aura focus:ring-aura"
              />
              {minutes} minutes
            </label>
          ))}
        </div>
      </fieldset>
      <GameSettings where="lobby" touch={touch} />
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <Button data-testid="survival-start" onClick={start} disabled={running}>
          {screen === 'results' ? 'Play again' : 'Start Survival'}
        </Button>
        <p data-testid="survival-best" data-best={best ?? ''} className="text-sm text-aura">
          Longest survived ({length} minutes): {best === null ? 'none yet' : clockText(best)}
        </p>
      </div>

      {!running && <ProgressionPanel />}

      {screen === 'results' && result && outcome && (
        <section
          ref={resultsRef}
          aria-labelledby="results-heading"
          data-testid="survival-results"
          data-outcome={outcome}
          className="mt-6 max-w-xl rounded-2xl border border-line bg-panel p-6"
        >
          <h2 id="results-heading" className="font-display text-2xl font-semibold text-cream">
            The run is over
          </h2>
          <p role="status" className="mt-2 text-sm text-plasma">
            {outcome === 'goal'
              ? `${LENGTH_WORDS[runLength]} minutes, and the night is survived. The cats remain.`
              : OUTCOME_TEXT[outcome]}
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-2 text-sm text-white">
            <dt className="text-aura">Time survived</dt>
            <dd data-testid="survival-result-time">{clockText(result.time)}</dd>
            <dt className="text-aura">Run length</dt>
            <dd data-testid="survival-result-length">{clockText(runLength * 60_000)}</dd>
            <dt className="text-aura">Cats sent home</dt>
            <dd data-testid="survival-result-sent-home">{result.sentHome}</dd>
            <dt className="text-aura">Tufts of fur gathered</dt>
            <dd data-testid="survival-result-tufts">{result.earned}</dd>
          </dl>
          {result.keepers.length > 1 && (
            <ul data-testid="survival-result-keepers" className="mt-3 space-y-1 text-sm text-white">
              {result.keepers.map((k, i) => (
                <li key={i}>
                  <span className="font-semibold text-cream">
                    Player {i + 1}, {k.name}
                  </span>
                  {k.down ? ' (down at the end)' : ''}:{' '}
                  {k.weapons.length === 0
                    ? 'nothing'
                    : k.weapons.map((w, n) => {
                        const tier = tierStyle({ kind: 'weapon', id: w.id, level: w.level });
                        return (
                          <span key={w.id} data-weapon={w.id} data-tier={tier.tier}>
                            {n > 0 ? ', ' : ''}
                            <span className={tier.className}>
                              {w.name} {w.level}
                            </span>{' '}
                            ({tier.name})
                          </span>
                        );
                      })}
                  .
                </li>
              ))}
            </ul>
          )}
          {result.reached.length > 0 && (
            <ul data-testid="survival-result-milestones" className="mt-3 text-sm text-plasma">
              {result.reached.map((id) => (
                <li key={id}>
                  {MILESTONES[id].text}: done. {unlockedBy(id)}
                </li>
              ))}
            </ul>
          )}
          <Button className="mt-4" onClick={start}>
            Play again
          </Button>
        </section>
      )}

      {running && (
        // The play area: the whole page while a run lasts.
        <div
          ref={areaRef}
          tabIndex={-1}
          data-testid="survival-area"
          data-xenocat-ignore
          data-screen={screen}
          data-time={hud?.time ?? 0}
          data-resolve={hud?.resolve ?? ARENA_CONFIG.hero.resolve}
          data-cats={hud?.cats ?? 0}
          data-windups={hud?.windUps ?? 0}
          data-windups-begun={hud?.windUpsBegun ?? 0}
          data-boss-windup={hud?.bossWindUp ?? ''}
          data-boss-windups-begun={hud?.bossWindUpsBegun ?? 0}
          data-pickups={hud?.pickups ?? 0}
          data-pickups-taken={hud?.pickupsTaken ?? 0}
          data-last-pickup={hud?.lastPickup ?? ''}
          data-sent-home={hud?.sentHome ?? 0}
          data-hero-facing={hud?.heroes[0]?.facing ?? ''}
          data-hero2-facing={hud?.heroes[1]?.facing ?? ''}
          data-hero-x={hud?.heroX ?? 0}
          data-hero-y={hud?.heroY ?? 0}
          data-effect={hud?.effect ?? ''}
          data-level={hud?.level ?? 1}
          data-boss={hud?.boss ? Math.round(hud.boss.homesickness) : ''}
          data-weapons={hud?.weapons ?? 'laser-pointer:1'}
          data-players={runPlayers}
          data-chooser={chooser}
          data-hero2-x={hud?.heroes[1]?.x ?? ''}
          data-hero2-y={hud?.heroes[1]?.y ?? ''}
          data-down={hud?.heroes.map((h) => (h.down ? 1 : 0)).join(' ') ?? ''}
          data-aim={aimMode}
          data-graphics={graphics}
          data-crosshair={hud?.crosshair ?? ''}
          data-zoom={hud?.zoom ?? ''}
          className={`fixed inset-0 z-[9998] select-none overflow-hidden bg-void outline-none${
            aimMode === 'crosshair' && screen === 'playing' ? ' cursor-none' : ''
          }`}
        >
          <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 h-full w-full" />
          {hud?.boss && (
            <div
              data-testid="survival-boss"
              className="pointer-events-none absolute inset-x-0 top-24 mx-auto flex w-full max-w-md flex-col items-center gap-1 px-4 text-sm font-semibold text-cream"
            >
              <span id="boss-label">{VARIETIES.mega.name}</span>
              <div
                role="meter"
                aria-labelledby="boss-label"
                aria-valuemin={0}
                aria-valuemax={Math.round(hud.boss.limit)}
                aria-valuenow={Math.round(hud.boss.homesickness)}
                aria-valuetext={`Homesickness ${Math.round((100 * hud.boss.homesickness) / hud.boss.limit)}%`}
                className="h-3 w-full overflow-hidden rounded-full border border-line bg-panel"
              >
                <div
                  className="h-full bg-aura"
                  style={{
                    width: `${(100 * Math.min(hud.boss.homesickness, hud.boss.limit)) / hud.boss.limit}%`,
                  }}
                />
              </div>
            </div>
          )}
          <p
            role="status"
            data-testid="survival-notice"
            className="pointer-events-none absolute inset-x-0 top-40 px-4 text-center font-display text-lg font-semibold text-plasma"
          >
            {notice}
          </p>
          <div className="relative flex flex-wrap items-center gap-6 p-4 text-sm font-semibold text-cream">
            {showFps && (
              <p data-testid="survival-fps" data-frame-ms={hud?.frameMs ?? ''}>
                {hud?.frameMs ?? 0} ms · {hud?.cats ?? 0} cats
              </p>
            )}
            <p data-testid="survival-time">
              Time {clockText(hud?.time ?? 0)} / {clockText(runLength * 60_000)}
            </p>
            <div className="flex items-center gap-2">
              <span id="resolve-label">{runPlayers === 2 ? 'Player 1 Resolve' : 'Resolve'}</span>
              <div
                role="meter"
                aria-labelledby="resolve-label"
                aria-valuemin={0}
                aria-valuemax={hud?.maxResolve ?? ARENA_CONFIG.hero.resolve}
                aria-valuenow={hud?.resolve ?? ARENA_CONFIG.hero.resolve}
                className="h-2 w-32 overflow-hidden rounded-full bg-panel"
              >
                <div
                  className="h-full bg-plasma"
                  style={{
                    width: `${(100 * (hud?.resolve ?? 1)) / (hud?.maxResolve ?? 1)}%`,
                  }}
                />
              </div>
              <span data-testid="survival-resolve">
                {hud?.heroes[0]?.down
                  ? `Down, back in ${Math.ceil(hud.heroes[0].backIn / 1000)} s`
                  : Math.ceil(hud?.resolve ?? 100)}
              </span>
            </div>
            {hud && hud.heroes.length > 1 && (
              <div className="flex items-center gap-2">
                <span id="resolve2-label">Player 2 Resolve</span>
                <div
                  role="meter"
                  aria-labelledby="resolve2-label"
                  aria-valuemin={0}
                  aria-valuemax={hud.heroes[1].maxResolve}
                  aria-valuenow={hud.heroes[1].resolve}
                  className="h-2 w-32 overflow-hidden rounded-full bg-panel"
                >
                  <div
                    className="h-full bg-aura"
                    style={{
                      width: `${(100 * hud.heroes[1].resolve) / hud.heroes[1].maxResolve}%`,
                    }}
                  />
                </div>
                <span data-testid="survival-resolve2">
                  {hud.heroes[1].down
                    ? `Down, back in ${Math.ceil(hud.heroes[1].backIn / 1000)} s`
                    : Math.ceil(hud.heroes[1].resolve)}
                </span>
              </div>
            )}
            <p data-testid="survival-sent-home">Cats sent home: {hud?.sentHome ?? 0}</p>
            <div className="flex items-center gap-2">
              <span data-testid="survival-level">Level {hud?.level ?? 1}</span>
              <div
                role="progressbar"
                aria-label="Experience"
                aria-valuemin={0}
                aria-valuemax={hud?.xpToNext ?? 5}
                aria-valuenow={hud?.xp ?? 0}
                className="h-2 w-24 overflow-hidden rounded-full bg-panel"
              >
                <div
                  className="h-full bg-aura"
                  style={{ width: `${(100 * (hud?.xp ?? 0)) / (hud?.xpToNext ?? 5)}%` }}
                />
              </div>
            </div>
            {screen === 'playing' && (
              <Button className="ml-auto" onClick={pause}>
                Pause
              </Button>
            )}
          </div>

          {screen === 'choosing' && choices && (
            <div
              key={chooser}
              ref={choiceRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="level-up-heading"
              aria-describedby="level-up-help"
              data-testid="survival-level-up"
              className="absolute inset-0 z-20 flex items-center justify-center bg-void/60 p-4"
            >
              <div className="w-full max-w-lg rounded-2xl border border-line bg-panel p-6">
                <h2 id="level-up-heading" className="font-display text-xl text-cream">
                  Level {choiceLevel}.{' '}
                  {runPlayers === 2 ? `Player ${chooser + 1}, choose one.` : 'Choose one.'}
                </h2>
                <p id="level-up-help" className="mt-1 text-sm text-aura">
                  {touch
                    ? 'Tap a choice.'
                    : `Press 1 to ${choices.length}, or use the arrow keys and Enter.`}
                </p>
                <ol className="mt-4 grid gap-2">
                  {choices.map((choice, i) => {
                    const { name, description, change } = describeChoice(choice);
                    const kind =
                      choice.kind === 'weapon'
                        ? 'Weapon'
                        : choice.kind === 'passive'
                          ? 'Passive'
                          : 'Rest';
                    const tier = choice.kind === 'restore' ? null : tierStyle(choice);
                    return (
                      <li key={i}>
                        <button
                          type="button"
                          data-choice={choice.kind === 'restore' ? 'restore' : choice.id}
                          data-kind={choice.kind}
                          data-level={choice.kind === 'restore' ? '' : choice.level}
                          data-tier={tier?.tier ?? ''}
                          onClick={() => choose(i)}
                          className="w-full rounded-xl border border-line bg-void/70 p-3 text-left text-sm text-white hover:border-aura focus-visible:outline focus-visible:outline-2 focus-visible:outline-plasma"
                        >
                          <span className="font-semibold text-plasma">{i + 1}.</span>{' '}
                          <span className={`font-semibold ${tier?.className ?? ''}`}>{name}</span>{' '}
                          <span className="text-aura">({kind})</span>
                          {tier && (
                            <>
                              {' '}
                              <span
                                data-testid="choice-tier"
                                className={`text-xs font-semibold ${tier.className}`}
                              >
                                {tier.name}
                              </span>
                            </>
                          )}
                          <span className="mt-1 block text-aura">{description}</span>
                          {change && (
                            <span
                              data-testid="choice-change"
                              className="mt-1 block font-semibold text-cream"
                            >
                              {change}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </div>
          )}

          {screen === 'paused' && (
            <div
              ref={pauseRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="pause-heading"
              className="absolute inset-0 z-20 flex items-center justify-center bg-void/60 p-4"
            >
              <div className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-panel p-6 text-center">
                <h2 id="pause-heading" className="font-display text-xl text-cream">
                  Paused
                </h2>
                <p className="mt-2 text-sm text-aura">The cats wait. They are patient.</p>
                {pausedState && <PauseSummary state={pausedState} />}
                <GameSettings where="pause" touch={touch} />
                <div className="mt-4 flex justify-center gap-3">
                  <Button onClick={resume}>Resume</Button>
                  <Button onClick={giveUp}>Give up</Button>
                </div>
              </div>
            </div>
          )}

          {touch && screen === 'playing' && (
            <MovementPad onDirection={onPad} className="fixed bottom-8 left-8 z-10" />
          )}
        </div>
      )}
    </div>
  );
}
