'use client';

import {
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { XMarkIcon } from '@heroicons/react/20/solid';
import { Button } from '@/app/ui/button';
import {
  type Arena,
  ARENA_CONFIG,
  type ArenaOutcome,
  BLADE_RADIUS,
  createArena,
  gemSize,
  runLengthConfig,
} from './arena';
import {
  HERO_BODY_SVGS,
  HERO_TOOL_SVGS,
  KIT_SVG,
  PATCH_SVG,
  PICKUP_SVG,
  VARIETY_SVG,
} from './arena-art';
import { drawEnemyShot, drawRareMarker, drawTelegraph } from './attack-art';
import { drawSpace } from './space-backdrop';
import type { PadAction } from './gamepad';
import { menuPress, useGamepads } from './gamepad-view';
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
  ENDLESS,
  RUN_LENGTHS,
  type RunLength,
  bestOf,
  clockText,
  dayText,
  lengthName,
  readAim,
  readBest,
  readCharacterBest,
  recordCharacterRun,
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
import { LeaderboardEntry } from './leaderboard-entry';
import { startSurvivalRun } from '@/app/lib/actions';
import { createRandom, freshSeed } from './random';
import {
  CROWD_ARSENAL,
  FUSION_START,
  PICKUPS_HOOK_CHANCE,
  activeTestHooks,
  parseTestHooks,
} from './test-hooks';
import { GameSettings } from './game-settings';
import { PauseSummary } from './pause-summary';
import { GoldenReel, REEL_HOLD_MS, REEL_SPIN_MS } from './golden-reel';
import { BossBar, HudBar, createHudStore, hudData } from './survival-hud';
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
  'tennis-ball': '#d9f99d',
  'serve-machine': '#bef264',
  cucumber: '#86efac',
  'pickle-jar': '#4ade80',
};

/** How each weapon's zone is drawn (r, g, b); the Thunderous Vacuum's is the default. */
const ZONE_COLOR: Record<string, string> = {
  'alarm-clock': '251, 191, 36',
  'grandfather-clock': '217, 119, 6',
};

/** How long an evolution's announcement stays, ms. */
const NOTICE_MS = 5000;

/**
 * How often the HUD is updated during a run, ms. Once this rendered the whole view, and
 * E10 slowed it to 250 ms for speed; since E11 it renders the HUD alone (survival-hud.tsx),
 * and 150 ms costs a slow machine only 2–3% against 250 (night run 2026-10-17).
 */
const HUD_EVERY_MS = 150;

/** Cats drawn this size, px. */
const CAT_SIZE = 44;
const HERO_SIZE = 56;
/** A game step more than this behind is dropped: the game slows rather than freezing. */
const MAX_STEPS_PER_FRAME = 240;
/** Never more than this many sounds start within `SOUND_WINDOW_MS`. */
const MAX_SOUNDS = 3;
const SOUND_WINDOW_MS = 300;

const FRAME_GUARD = { floorFps: 40, resumeFps: 50, smoothing: 0.1 };

type Flash = { x: number; y: number; until: number };

/** A run that reached its goal, by its length (an endless run has none to reach). */
const LENGTH_WORDS: Record<Exclude<RunLength, typeof ENDLESS>, string> = {
  5: 'Five',
  10: 'Ten',
  15: 'Fifteen',
};

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

/**
 * Each character's best for a run length, as one string (a snapshot that stays the same
 * while nothing changes): "ms@date" per character, in CHARACTERS order, "" for none.
 */
const characterBestsOf = (length: RunLength) =>
  (Object.keys(CHARACTERS) as CharacterId[])
    .map((id) => {
      const best = readCharacterBest(length, id);
      return best ? `${best.ms}@${best.date}` : '';
    })
    .join('|');

/** A boss sent home: the run slows to this share of its pace for `BOSS_SLOW_MS`. */
const BOSS_SLOW = 0.3;
const BOSS_SLOW_MS = 1400;
/** The screen shakes this long, this far at first (px). */
const BOSS_SHAKE_MS = 700;
const BOSS_SHAKE = 9;
/** The mothership's visit: down, the beam lifts the boss, away. */
const MOTHERSHIP_MS = 2200;
/** Each gem size (gemSize): its colour, and half its height, px. */
const GEM_COLOUR = ['#9d86ff', '#7dd3fc', '#c1e838', '#fbbf24'] as const;
const GEM_HEIGHT = [6, 7.5, 9, 11] as const;

/** Keeps Tab and Shift+Tab inside a modal <dialog>, as the start screen's windows do. */
function trapTab(event: ReactKeyboardEvent<HTMLDialogElement>) {
  if (event.key !== 'Tab') return;
  const focusable = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled])'
    )
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
}

function subscribeBest(onChange: () => void) {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
}

export default function ArenaGame({
  touch = false,
  signedIn = false,
}: {
  touch?: boolean;
  /** Whether the player is logged in: only then can a run go on the leaderboard. */
  signedIn?: boolean;
}) {
  const [screen, setScreen] = useState<Screen>('start');
  // The test hooks in effect for the run in progress (or just over): any keeps it
  // off the leaderboard.
  const [testHooks, setTestHooks] = useState<string[]>([]);
  // Counts the runs, so each one's results ask for its name afresh.
  const [runCount, setRunCount] = useState(0);
  // The server's id for the run (startSurvivalRun), once it has given one; null for
  // a run that is not on the leaderboard.
  const [runId, setRunId] = useState<Promise<string | null>>(() => Promise.resolve(null));
  // The HUD's numbers: a store of their own, which the HUD's components and the play
  // area's data- attributes follow, so an update does not render this whole view.
  const [hudStore] = useState(createHudStore);
  const [showFps, setShowFps] = useState(false);
  const [outcome, setOutcome] = useState<ArenaOutcome | null>(null);
  // The finished run's numbers, kept for the results screen.
  const [result, setResult] = useState<{
    time: number;
    sentHome: number;
    earned: number;
    reached: MilestoneId[];
    /** What each weapon held did, most homesickness first (arena.weaponReport). */
    weapons: { id: WeaponId; name: string; homesickness: number; sentHome: number }[];
    /** In co-op: each Keeper, who he went out as, what he carried, how he ended. */
    keepers: {
      name: string;
      weapons: { id: WeaponId; name: string; level: number }[];
      down: boolean;
    }[];
  } | null>(null);
  // A level-up's choices, while the run waits for one.
  const [choices, setChoices] = useState<Choice[] | null>(null);
  // What the Keeper whose choice waits has left to reroll and to skip.
  const [uses, setUses] = useState({ rerolls: 0, skips: 0 });
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
  // A golden chest's reel, while it spins and shows what it landed on.
  const [reel, setReel] = useState<{ rewards: number; picks: number; key: number } | null>(null);
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
  const characterBests = useSyncExternalStore(
    subscribeBest,
    () => characterBestsOf(length),
    () => ''
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
  const resultsRef = useRef<HTMLDialogElement>(null);
  const lobbyActionsRef = useRef<HTMLDivElement>(null);
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
      // And the best of each character who went out (both, in co-op).
      for (const id of new Set([characterRef.current, secondRef.current ?? characterRef.current])) {
        recordCharacterRun(lengthRef.current, id, time);
      }
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
        weapons: arena.weaponReport().map((w) => ({ ...w, name: WEAPONS[w.id].name })),
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
    setRunCount((count) => count + 1);
    const chosen = readLength();
    lengthRef.current = chosen;
    setRunLength(chosen);
    const lengthed = runLengthConfig(chosen);
    speedRef.current = speed;
    crowdRef.current = crowd !== null || elite;
    // Any test hook keeps the run off the leaderboard: they are live for everyone,
    // and a seed alone lets a run be practised until it is known by heart.
    const hooksInEffect = activeTestHooks(window.location.search);
    const rankable = hooksInEffect.length === 0;
    setTestHooks(hooksInEffect);
    // A run that can go on the leaderboard is started on the server now: its length
    // and its start are the server's, and its time cannot outrun the real one.
    setRunId(
      signedIn && rankable ? startSurvivalRun(chosen).catch(() => null) : Promise.resolve(null)
    );
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
    hudStore.set(null);
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
        setUses(arena.levelUpUses());
      } else {
        setChoices(null);
        show('playing');
      }
    },
    [show]
  );

  /** After a reroll, new choices; after a skip, the next choice or the run. */
  const refresh = useCallback(() => {
    const arena = arenaRef.current;
    if (!arena) return;
    const next = arena.choices();
    if (next) {
      setChoices([...next]);
      setChoiceLevel(arena.choiceLevel());
      setChooser(arena.chooser());
      setUses(arena.levelUpUses());
    } else {
      setChoices(null);
      show('playing');
    }
  }, [show]);
  const reroll = useCallback(() => {
    if (screenRef.current !== 'choosing' || !arenaRef.current?.reroll()) return;
    refresh();
  }, [refresh]);
  const skip = useCallback(() => {
    if (screenRef.current !== 'choosing' || !arenaRef.current?.skip()) return;
    refresh();
  }, [refresh]);

  // A controller works the run as the keys do (gamepad.ts): Start pauses and resumes,
  // and the menus are worked with the d-pad, A, B, and Y and X at a level-up.
  const pads = useGamepads((player: number, action: PadAction, count: number) => {
    const now = screenRef.current;
    if (now === 'playing') {
      if (action === 'pause') show('paused');
    } else if (now === 'paused') {
      if (action === 'pause' || action === 'back') show('playing');
      else menuPress(pauseRef.current, action);
    } else if (now === 'choosing') {
      // With a pad each in co-op, the choice is the chooser's to make.
      if (count > 1 && player !== arenaRef.current?.chooser()) return;
      if (action === 'reroll') reroll();
      else if (action === 'skip') skip();
      else menuPress(choiceRef.current, action);
    } else if (now === 'results' && resultsRef.current?.open) {
      if (action === 'back') resultsRef.current.close();
      else menuPress(resultsRef.current, action);
    } else if (action === 'pause') {
      // In the lobby, Start begins a run (or the next).
      lobbyActionsRef.current
        ?.querySelector<HTMLButtonElement>('[data-testid="survival-start"]')
        ?.click();
    }
  });

  const running = screen === 'playing' || screen === 'choosing' || screen === 'paused';

  // The play area's data- attributes (what the browser tests read): now, and at each
  // HUD update.
  useLayoutEffect(() => {
    if (!running) return;
    const write = () => {
      const area = areaRef.current;
      if (!area) return;
      for (const [name, value] of Object.entries(hudData(hudStore.get()))) {
        area.setAttribute(name, value);
      }
    };
    write();
    return hudStore.subscribe(write);
  }, [running, hudStore]);

  // Focus: into the play area when a run starts (and back after a choice), onto the
  // first choice at a level-up, onto Resume when paused, and when over onto the
  // leaderboard's name, or Play again, in the results window.
  useEffect(() => {
    if (screen === 'playing') areaRef.current?.focus();
    if (screen === 'choosing') choiceRef.current?.querySelector('button')?.focus();
    if (screen === 'paused') pauseRef.current?.querySelector('button')?.focus();
    if (screen === 'results') {
      // The name for the leaderboard, when the run can go on it; otherwise Play again.
      const results = resultsRef.current;
      if (results && !results.open) results.showModal();
      (
        results?.querySelector<HTMLElement>('#leaderboard-name') ??
        results?.querySelector<HTMLElement>('[data-play-again]')
      )?.focus();
    }
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
    // Nor does the page behind it scroll (on a phone, a swipe would carry it along).
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      for (const element of marked) element.removeAttribute('inert');
      root.style.overflow = overflow;
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
    const kitSprites = Object.fromEntries(
      (Object.keys(KIT_SVG) as (keyof typeof KIT_SVG)[]).map((kind) => [
        kind,
        bitmapOf(
          `data:image/svg+xml;charset=utf-8,${encodeURIComponent(KIT_SVG[kind])}`,
          64,
          redraw
        ),
      ])
    ) as Record<keyof typeof KIT_SVG, () => HTMLCanvasElement | null>;
    const guard = createFrameGuard(FRAME_GUARD);
    const held = new Set<string>();
    const flashes: Flash[] = [];
    // A boss sent home: the mothership's visits, the slow motion and the shake.
    const motherships: { x: number; y: number; type: number; start: number }[] = [];
    let slowUntil = 0;
    let shakeUntil = 0;
    // While a golden chest's reel shows, the run and a waiting level-up's choices wait for it.
    let reelUntil = 0;
    const met = new Set<number>();
    const sounds: number[] = [];
    // One purr at a time: the cats sent home together would otherwise purr over each
    // other, louder with every one. Until then, the next is not started.
    let purringUntil = 0;
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
      if (time < shakeUntil) {
        const k = ((shakeUntil - time) / BOSS_SHAKE_MS) * BOSS_SHAKE;
        context.translate((Math.random() * 2 - 1) * k, (Math.random() * 2 - 1) * k);
      }
      // Outer space: stars sliding at their own pace as he walks (space-backdrop.ts).
      drawSpace(context, {
        camX: cam.x,
        camY: cam.y,
        width,
        height,
        zoom: cam.zoom,
        time,
        light,
      });

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

      // The zones' reach (the Thunderous Vacuum, the clocks), and the gems lying about.
      for (const zone of arena.zones()) {
        const rgb = ZONE_COLOR[zone.weapon] ?? '157, 134, 255';
        context.fillStyle = `rgba(${rgb}, ${0.1 + 0.04 * Math.sin(time / 180)})`;
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
        // Gems that joined are bigger, and their own colour.
        const size = gemSize(gem.value);
        const h = GEM_HEIGHT[size];
        context.fillStyle = GEM_COLOUR[size];
        context.beginPath();
        context.moveTo(x, y - h);
        context.lineTo(x + h * 0.67, y);
        context.lineTo(x, y + h);
        context.lineTo(x - h * 0.67, y);
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
      // The Frying Pan, swung at the cat it swats, fading.
      const pan = kitSprites['frying-pan']();
      if (pan) {
        for (const swat of arena.swats()) {
          context.save();
          context.globalAlpha = Math.min(Math.max(swat.until - state.time, 0) / 240, 1);
          context.translate(swat.x - camX, swat.y - camY);
          context.rotate(swat.angle);
          context.drawImage(pan, 14, -20, 40, 40);
          context.restore();
        }
      }

      // An attack winding up (an elite's, a boss's): where it will go, filling as the moment nears.
      for (const warning of arena.telegraphs()) drawTelegraph(context, warning, camX, camY);

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
        if (chest.golden) {
          // A boss's: bigger, gold, and shining.
          if (!light) {
            context.shadowColor = '#fbbf24';
            context.shadowBlur = 18 + Math.sin(time / 180) * 6;
          }
          context.fillStyle = '#fbbf24';
          context.fillRect(x - 16, y - 11, 32, 22);
          context.shadowBlur = 0;
          context.fillStyle = '#b45309';
          context.fillRect(x - 16, y - 3, 32, 2);
          context.fillStyle = '#fef3c7';
          context.fillRect(x - 4, y - 4, 8, 8);
          continue;
        }
        context.fillStyle = '#b8874f';
        context.fillRect(x - 12, y - 8, 24, 16);
        context.fillStyle = '#c1e838';
        context.fillRect(x - 3, y - 3, 6, 6);
      }

      // The cats; a homesick one with its bar (the rare ones are marked after, over them all).
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
        // Startled by a Cucumber: it shows, as it runs.
        if (cat.fleeUntil > state.time) {
          const startle = kitSprites.startle();
          if (startle) context.drawImage(startle, x - 9, y - half - 24, 18, 18);
        }
      }
      // The rare cats (elites, visiting xenocats) marked over the crowd, so none is lost in it.
      for (const cat of arena.cats()) {
        if (cat.variety || (!cat.elite && !cat.visitor)) continue;
        const x = cat.x - camX;
        const y = cat.y - camY;
        if (x < -CAT_SIZE || y < -CAT_SIZE || x > width + CAT_SIZE || y > height + CAT_SIZE)
          continue;
        drawRareMarker(context, x, y, CAT_SIZE / 2, cat.elite, time, light);
      }
      // The Static Socks, clinging to their cats.
      const sock = kitSprites['static-sock']();
      if (sock) {
        for (const s of arena.socks()) {
          const x = s.x - camX;
          const y = s.y - camY;
          if (x < -20 || y < -20 || x > width + 20 || y > height + 20) continue;
          context.drawImage(sock, x - 2, y - 14, 22, 22);
        }
      }

      // The cats' shots: the Laser Cats' small and red, the elites' and the bosses' their own.
      for (const shot of arena.shots()) {
        const x = shot.x - camX;
        const y = shot.y - camY;
        if (x < -20 || y < -20 || x > width + 20 || y > height + 20) continue;
        drawEnemyShot(context, shot, x, y, light);
      }

      // What his weapons fired, and the Can Opener's blades.
      for (const shot of arena.projectiles()) {
        const x = shot.x - camX;
        const y = shot.y - camY;
        if (x < -20 || y < -20 || x > width + 20 || y > height + 20) continue;
        // A tennis ball, and a whole cucumber (its slices are plain), spin as they fly.
        const kit =
          shot.weapon === 'tennis-ball' || (shot.weapon === 'cucumber' && !shot.bit)
            ? kitSprites[shot.weapon]()
            : null;
        if (kit) {
          const r = Math.max(shot.radius, 8);
          context.save();
          context.translate(x, y);
          context.rotate(time / 80);
          context.drawImage(kit, -r, -r, r * 2, r * 2);
          context.restore();
          continue;
        }
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

      // A boss's ring of light, spreading: the cats it reaches go home.
      for (const ring of arena.rings()) {
        const { ringMs, ringRadius } = arena.config.bossHome;
        const t = Math.min((state.time - ring.start) / ringMs, 1);
        context.strokeStyle = `rgba(193, 232, 56, ${(1 - t) * 0.8})`;
        context.lineWidth = light ? 3 : 6 + (1 - t) * 10;
        context.beginPath();
        context.arc(ring.x - camX, ring.y - camY, t * ringRadius, 0, 2 * Math.PI);
        context.stroke();
      }

      // The mothership, come for a boss: down, a beam lifts it, and away.
      for (let i = motherships.length - 1; i >= 0; i--) {
        const ship = motherships[i];
        const t = (time - ship.start) / MOTHERSHIP_MS;
        if (t >= 1) {
          motherships.splice(i, 1);
          continue;
        }
        const x = ship.x - camX;
        const ground = ship.y - camY;
        // Where the saucer hovers: it drops in, waits, and leaves upwards.
        const hover = ground - 190;
        const shipY =
          t < 0.2
            ? hover - (1 - t / 0.2) * 400
            : t > 0.75
              ? hover - ((t - 0.75) / 0.25) * 500
              : hover;
        // The beam, while it lifts the boss (to 0.75).
        const beam = t > 0.15 && t < 0.75 ? Math.min((t - 0.15) / 0.08, 1, (0.75 - t) / 0.08) : 0;
        if (beam > 0) {
          context.fillStyle = `rgba(224, 224, 179, ${beam * (light ? 0.25 : 0.35)})`;
          context.beginPath();
          context.moveTo(x - 22, shipY + 10);
          context.lineTo(x + 22, shipY + 10);
          context.lineTo(x + 70, ground + 30);
          context.lineTo(x - 70, ground + 30);
          context.closePath();
          context.fill();
          // The boss rises in it, smaller as it goes, into the saucer.
          const lift = Math.min(Math.max((t - 0.2) / 0.5, 0), 1);
          const size = 120 * (1 - lift * 0.8);
          const bitmap = bossSprite(ship.type) ?? sprites[ship.type]();
          if (bitmap) {
            context.globalAlpha = 1 - lift * 0.6;
            const y = ground + (shipY - ground) * lift;
            context.drawImage(bitmap, x - size / 2, y - size / 2, size, size);
            context.globalAlpha = 1;
          }
        }
        // The saucer: a dome, a wide hull, and lights that run round it.
        context.fillStyle = '#c1e838';
        context.beginPath();
        context.ellipse(x, shipY - 8, 26, 18, 0, Math.PI, 2 * Math.PI);
        context.fill();
        context.fillStyle = '#9d86ff';
        context.beginPath();
        context.ellipse(x, shipY, 70, 16, 0, 0, 2 * Math.PI);
        context.fill();
        for (let k = 0; k < 6; k++) {
          const lit = (Math.floor(time / 120) + k) % 3 === 0;
          context.fillStyle = lit ? '#fef3c7' : '#2d2f47';
          context.beginPath();
          context.arc(x - 50 + k * 20, shipY + 3, 4, 0, 2 * Math.PI);
          context.fill();
        }
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
            // Pointing left, it is turned over too, so its top stays up.
            if (Math.cos(h.lookAngle) < 0) context.scale(1, -1);
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
      // A golden chest's reel holds the run still while it spins and shows.
      if (now < reelUntil) carry = 0;
      else carry += real * speedRef.current * (now < slowUntil ? BOSS_SLOW : 1);
      // Alone, WASD and the arrow keys both walk him; in co-op, each player his own. A
      // controller walks him when no key does (in co-op, the second pad player 2).
      const moves = (v: Vec) => v.x !== 0 || v.y !== 0;
      const [stick, stick2] = pads.current.walks;
      const keys = walkDirection(held, twoPlayers ? PLAYER_KEYS[0] : undefined);
      const input = moves(keys) ? keys : moves(stick) ? stick : padRef.current;
      const keys2 = twoPlayers ? walkDirection(held, PLAYER_KEYS[1]) : { x: 0, y: 0 };
      const input2 = moves(keys2) || !twoPlayers ? keys2 : stick2;
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
          if (player && now >= purringUntil) {
            const purr = soundsFor(typeOf(event.type)).purr;
            sound(() => {
              if (!player.play(purr)) return;
              purringUntil = now + Math.max(...purr.map((t) => t.at + t.duration)) * 1000;
            });
          }
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
        } else if (event.kind === 'boss-home') {
          motherships.push({ x: event.x, y: event.y, type: event.type, start: now });
          slowUntil = now + BOSS_SLOW_MS;
          shakeUntil = now + BOSS_SHAKE_MS;
          important(`The mothership has come for the giant ${CAT_TYPES[event.type].name}.`);
          if (player) player.play(soundsFor(CAT_TYPES[event.type]).wake);
        } else if (event.kind === 'chest' && event.golden) {
          reelUntil = now + REEL_SPIN_MS + REEL_HOLD_MS;
          setReel({ rewards: event.rewards, picks: event.picks, key: now });
          if (player) player.play(soundsFor(CAT_TYPES[0]).wake);
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
      if (over || now - lastHud > HUD_EVERY_MS) {
        lastHud = now;
        hudStore.set({
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
      if (reelUntil > 0 && now >= reelUntil) {
        reelUntil = 0;
        setReel(null);
      }
      if (over) finish(over);
      else if (arena.choices() && reelUntil === 0) {
        // The run waits for a choice; the HUD shows the level it is for.
        carry = 0;
        hudStore.set((before) =>
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
        setUses(arena.levelUpUses());
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
        const picks = buttons.filter((b) => b.hasAttribute('data-choice'));
        if (Number.isInteger(number) && number >= 1 && number <= picks.length) {
          event.preventDefault();
          choose(number - 1);
        } else if (
          event.key === 'r' ||
          event.key === 'R' ||
          event.key === 'x' ||
          event.key === 'X'
        ) {
          // Not a held key, nor a browser shortcut (Ctrl+R reloads).
          if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
          event.preventDefault();
          if (event.key === 'r' || event.key === 'R') reroll();
          else skip();
        } else if (['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(event.key)) {
          event.preventDefault();
          const enabled = buttons.filter((b) => !b.disabled);
          const at = enabled.indexOf(document.activeElement as HTMLButtonElement);
          const step = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1;
          enabled[(at + step + enabled.length) % enabled.length]?.focus();
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
  }, [running, finish, pause, show, choose, reroll, skip, hudStore, pads]);

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
          : 'Walk with WASD, the arrow keys, or a controller’s stick. Esc (or Start) pauses.'}
      </p>
      {!running && <ProgressionPanel />}
      {!touch && (
        <fieldset className="mt-4 text-sm text-aura">
          <legend className="font-semibold text-cream">Keepers</legend>
          <div className="mt-1 flex flex-wrap gap-x-4">
            <label className="flex min-h-11 items-center gap-2">
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
            <label className="flex min-h-11 items-center gap-2">
              <input
                type="radio"
                name="survival-players"
                data-testid="survival-players-2"
                checked={players === 2}
                onChange={() => setPlayers(2)}
                className="border-line bg-void text-aura focus:ring-aura"
              />
              Two, at one keyboard: player 1 walks with WASD, player 2 with the arrow keys (or a
              controller each)
            </label>
          </div>
          {players === 2 && (
            <label className="mt-2 flex flex-wrap items-center gap-2">
              Player 2 goes out as
              <select
                data-testid="survival-player2-character"
                value={secondCharacter}
                onChange={(event) => setSecondCharacter(event.target.value as CharacterId)}
                className="min-h-11 rounded-lg border-line bg-void py-1 text-sm text-cream focus:ring-aura"
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
        <div className="mt-1 flex flex-wrap gap-x-4">
          {RUN_LENGTHS.map((minutes) => (
            <label key={minutes} className="flex min-h-11 items-center gap-2">
              <input
                type="radio"
                name="survival-length"
                data-testid={`survival-length-${minutes}`}
                checked={length === minutes}
                onChange={() => writeLength(minutes)}
                className="border-line bg-void text-aura focus:ring-aura"
              />
              {lengthName(minutes)}
            </label>
          ))}
        </div>
      </fieldset>
      <GameSettings where="lobby" touch={touch} />
      <div ref={lobbyActionsRef} className="mt-4 flex flex-wrap items-center gap-4">
        <Button data-testid="survival-start" onClick={start} disabled={running}>
          {screen === 'results' ? 'Play again' : 'Start Survival'}
        </Button>
        <p data-testid="survival-best" data-best={best ?? ''} className="text-sm text-aura">
          Longest survived ({lengthName(length)}): {best === null ? 'none yet' : clockText(best)}
        </p>
      </div>
      <h3 id="survival-character-bests" className="mt-3 text-sm font-semibold text-cream">
        Each character’s best ({lengthName(length)})
      </h3>
      <ul
        aria-labelledby="survival-character-bests"
        data-testid="survival-character-bests"
        className="mt-1 space-y-0.5 text-sm text-aura"
      >
        {(Object.keys(CHARACTERS) as CharacterId[]).map((id, i) => {
          if (!hasCharacter(progress, id)) return null;
          const [ms, date] = (characterBests.split('|')[i] ?? '').split('@');
          return (
            <li key={id} data-character={id} data-best={ms ?? ''}>
              {CHARACTERS[id].name}:{' '}
              {ms ? `${clockText(Number(ms))}, set ${dayText(date)}` : 'none yet'}
            </li>
          );
        })}
      </ul>

      {screen === 'results' && result && outcome && (
        // A native modal <dialog>, opened when the run ends: the page behind it is inert,
        // and Esc or the X closes it, leaving the lobby with its own Play again.
        <dialog
          ref={resultsRef}
          aria-labelledby="results-heading"
          data-testid="survival-results"
          data-outcome={outcome}
          onKeyDown={trapTab}
          onClick={(event) => {
            // A click on the backdrop (outside the window's box) closes it too.
            const box = event.currentTarget.getBoundingClientRect();
            const outside =
              event.clientX < box.left ||
              event.clientX > box.right ||
              event.clientY < box.top ||
              event.clientY > box.bottom;
            if (event.target === event.currentTarget && outside) event.currentTarget.close();
          }}
          onClose={() => lobbyActionsRef.current?.querySelector('button')?.focus()}
          className="m-auto max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-xl overflow-y-auto rounded-2xl border border-line bg-panel p-6 text-left text-white backdrop:bg-void/75 sm:max-h-[calc(100dvh-2rem)] sm:w-[calc(100vw-2rem)]"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="results-heading" className="font-display text-2xl font-semibold text-cream">
                The run is over
              </h2>
              <p role="status" className="mt-2 text-sm text-plasma">
                {outcome === 'goal' && runLength !== ENDLESS
                  ? `${LENGTH_WORDS[runLength]} minutes, and the night is survived. The cats remain.`
                  : OUTCOME_TEXT[outcome]}
              </p>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={() => resultsRef.current?.close()}
              className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-line bg-panel-raised text-cream hover:border-aura focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-plasma"
            >
              <XMarkIcon aria-hidden="true" className="size-5" />
            </button>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-2 text-sm text-white">
            <dt className="text-aura">Time survived</dt>
            <dd data-testid="survival-result-time">{clockText(result.time)}</dd>
            <dt className="text-aura">Run length</dt>
            <dd data-testid="survival-result-length">
              {runLength === ENDLESS ? 'Endless' : clockText(runLength * 60_000)}
            </dd>
            <dt className="text-aura">Cats sent home</dt>
            <dd data-testid="survival-result-sent-home">{result.sentHome}</dd>
            <dt className="text-aura">Tufts of fur gathered</dt>
            <dd data-testid="survival-result-tufts">{result.earned}</dd>
          </dl>
          {result.weapons.length > 0 && (
            <>
              <h3 id="survival-result-weapons" className="mt-4 text-sm font-semibold text-cream">
                What each weapon did
              </h3>
              <ol
                aria-labelledby="survival-result-weapons"
                data-testid="survival-result-weapons"
                className="mt-1 space-y-1 text-sm text-white"
              >
                {result.weapons.map((w) => (
                  <li key={w.id} data-weapon={w.id}>
                    <span className="font-semibold text-cream">{w.name}</span>:{' '}
                    {Math.round(w.homesickness).toLocaleString('en-GB')} homesickness,{' '}
                    {w.sentHome === 1 ? '1 cat' : `${w.sentHome.toLocaleString('en-GB')} cats`} sent
                    home
                  </li>
                ))}
              </ol>
            </>
          )}
          <LeaderboardEntry
            key={runCount}
            runId={runId}
            minutes={runLength}
            timeMs={result.time}
            sentHome={result.sentHome}
            signedIn={signedIn}
            testHooks={testHooks}
          />
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
          <Button className="mt-6" onClick={start} data-play-again>
            Play again
          </Button>
        </dialog>
      )}

      {running && (
        // The play area: the whole page while a run lasts.
        <div
          ref={areaRef}
          tabIndex={-1}
          data-testid="survival-area"
          data-xenocat-ignore
          data-screen={screen}
          data-players={runPlayers}
          data-chooser={chooser}
          data-aim={aimMode}
          data-graphics={graphics}
          className={`fixed inset-0 z-9998 select-none overflow-hidden bg-void outline-none${
            aimMode === 'crosshair' && screen === 'playing' ? ' cursor-none' : ''
          }`}
        >
          {/* No browser gesture (a scroll, a pinch) on the arena itself: a swipe is play. */}
          <canvas
            ref={canvasRef}
            aria-hidden="true"
            className="absolute inset-0 h-full w-full touch-none"
          />
          {reel && <GoldenReel key={reel.key} rewards={reel.rewards} picks={reel.picks} />}
          {/* Along the top, one under the other: the HUD (however many rows it wraps to
              on a narrow screen), the boss's bar, then the notice. Nothing overlaps. */}
          <div className="pointer-events-none relative flex flex-col gap-2">
            <HudBar
              store={hudStore}
              showFps={showFps}
              runLength={runLength}
              runPlayers={runPlayers}
              playing={screen === 'playing'}
              onPause={pause}
            />
            <BossBar store={hudStore} />
            <p
              role="status"
              data-testid="survival-notice"
              className="px-4 text-center font-display text-base font-semibold text-plasma sm:text-lg"
            >
              {notice}
            </p>
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
              // Scrolls when it does not fit (a phone on its side), centred when it does.
              className="absolute inset-0 z-20 flex overflow-y-auto bg-void/60 p-4"
            >
              <div className="m-auto w-full max-w-lg rounded-2xl border border-line bg-panel p-6 short:max-w-4xl short:p-4">
                <h2 id="level-up-heading" className="font-display text-xl text-cream">
                  Level {choiceLevel}.{' '}
                  {runPlayers === 2 ? `Player ${chooser + 1}, choose one.` : 'Choose one.'}
                </h2>
                <p id="level-up-help" className="mt-1 text-sm text-aura">
                  {touch
                    ? 'Tap a choice.'
                    : `Press 1 to ${choices.length}, or use the arrow keys and Enter. R rerolls, X skips. On a controller: the d-pad and A, Y rerolls, X skips.`}
                </p>
                <ol className="mt-4 grid gap-2 short:grid-cols-2">
                  {choices.map((choice, i) => {
                    const { name, description, change } = describeChoice(choice);
                    const kind = choice.kind === 'weapon' ? 'Weapon' : 'Passive';
                    const tier = tierStyle(choice);
                    return (
                      <li key={i} className="flex gap-2">
                        <button
                          type="button"
                          data-choice={choice.id}
                          data-kind={choice.kind}
                          data-level={choice.level}
                          data-tier={tier.tier}
                          onClick={() => choose(i)}
                          className="min-w-0 flex-1 rounded-xl border border-line bg-void/70 p-3 text-left text-sm text-white hover:border-aura focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-plasma"
                        >
                          <span className="font-semibold text-plasma">{i + 1}.</span>{' '}
                          <span className={`font-semibold ${tier.className}`}>{name}</span>{' '}
                          <span className="text-aura">({kind})</span>{' '}
                          <span
                            data-testid="choice-tier"
                            className={`text-xs font-semibold ${tier.className}`}
                          >
                            {tier.name}
                          </span>
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
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    data-testid="survival-reroll"
                    data-uses={uses.rerolls}
                    disabled={uses.rerolls <= 0}
                    onClick={reroll}
                    className="rounded-lg border border-line bg-void/70 px-3 py-2 text-sm font-semibold text-cream hover:border-aura focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-plasma disabled:opacity-50"
                  >
                    Reroll ({uses.rerolls} left)
                  </button>
                  <button
                    type="button"
                    data-testid="survival-skip"
                    data-uses={uses.skips}
                    disabled={uses.skips <= 0}
                    onClick={skip}
                    className="rounded-lg border border-line bg-void/70 px-3 py-2 text-sm font-semibold text-cream hover:border-aura focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-plasma disabled:opacity-50"
                  >
                    Skip, for some experience ({uses.skips} left)
                  </button>
                </div>
              </div>
            </div>
          )}

          {screen === 'paused' && (
            <div
              ref={pauseRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="pause-heading"
              // A click outside the window (on the dimmed run) resumes, as Resume does.
              onClick={(event) => {
                if (event.target === event.currentTarget) resume();
              }}
              className="absolute inset-0 z-20 flex items-center justify-center bg-void/60 p-4"
            >
              <div className="max-h-[calc(100dvh-2rem)] w-full max-w-4xl overflow-y-auto rounded-2xl border border-line bg-panel p-6 text-center">
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
