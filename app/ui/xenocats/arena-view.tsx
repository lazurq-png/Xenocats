'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Button } from '@/app/ui/button';
import { type Arena, ARENA_CONFIG, type ArenaOutcome, BLADE_RADIUS, createArena } from './arena';
import { HERO_SVGS, VARIETY_SVG } from './arena-art';
import { type Choice, WEAPONS, type WeaponId, describeChoice, evolutionText } from './arsenal';
import { SURVIVAL_BEST_KEY, bestOf, clockText, readBest, writeBest } from './arena-storage';
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
  WEAPON_UNLOCKS,
  applyRun,
  readProgress,
  runConfig,
  writeProgress,
} from './progression';
import { ProgressionPanel } from './progression-view';
import { createRandom, freshSeed } from './random';
import { type SoundPlayer, sharedSoundPlayer, soundsFor } from './sounds';
import { SCHEDULE, VARIETIES, type VarietyId } from './varieties';
import { isWalkKey, walkDirection } from './walking';
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
// (seconds) brings a Mega Cat that early, besides the schedule's.

type Screen = 'start' | 'playing' | 'choosing' | 'paused' | 'results';

/** How each weapon's shots are drawn. */
const SHOT_COLOR: Record<string, string> = {
  'cat-treats': '#fbbf24',
  'spray-bottle': '#7dd3fc',
  'yarn-ball': '#f472b6',
  'yarn-apocalypse': '#ec4899',
  hairball: '#a8865b',
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
};

const OUTCOME_TEXT: Record<ArenaOutcome, string> = {
  spent: 'His Resolve is spent. The cats remain.',
  'gave-up': 'He has given up. The cats remain.',
  goal: 'Five minutes, and the night is survived. The cats remain.',
};

/** What a milestone unlocks, in a sentence (or nothing). */
function unlockedBy(id: MilestoneId): string {
  const names = [
    ...Object.entries(WEAPON_UNLOCKS)
      .filter(([, milestone]) => milestone === id)
      .map(([weapon]) => WEAPONS[weapon as WeaponId].name),
    ...(Object.keys(CHARACTERS) as CharacterId[])
      .filter((c) => {
        const unlock = CHARACTERS[c].unlock;
        return unlock.kind === 'milestone' && unlock.milestone === id;
      })
      .map((c) => CHARACTERS[c].name),
  ];
  return names.length > 0 ? `Now available: ${names.join(', ')}.` : '';
}

function testHooks(): { seed: number; speed: number; boss: number | null } {
  const params = new URLSearchParams(window.location.search);
  const seed = Number(params.get('seed'));
  const speed = Number(params.get('speed'));
  const boss = params.has('boss') ? Number(params.get('boss')) : NaN;
  return {
    seed: Number.isInteger(seed) && seed > 0 ? seed : freshSeed(),
    speed: Number.isFinite(speed) && speed >= 1 ? Math.min(speed, 50) : 1,
    boss: Number.isFinite(boss) && boss >= 0 ? boss * 1000 : null,
  };
}

/** A sound for a cat of any kind: a variety sounds like the first xenocat type. */
const typeOf = (type: number) => CAT_TYPES[type] ?? CAT_TYPES[0];

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
  const [outcome, setOutcome] = useState<ArenaOutcome | null>(null);
  // The finished run's numbers, kept for the results screen.
  const [result, setResult] = useState<{
    time: number;
    sentHome: number;
    earned: number;
    reached: MilestoneId[];
  } | null>(null);
  // A level-up's choices, while the run waits for one.
  const [choices, setChoices] = useState<Choice[] | null>(null);
  // The level the waiting choice is for (several can wait after one gem).
  const [choiceLevel, setChoiceLevel] = useState(2);
  // An evolution's announcement, for a few seconds.
  const [notice, setNotice] = useState<string | null>(null);
  const choiceRef = useRef<HTMLDivElement>(null);
  const best = useSyncExternalStore(subscribeBest, readBest, () => null);
  const arenaRef = useRef<Arena | null>(null);
  const screenRef = useRef<Screen>('start');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const pauseRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLElement>(null);
  const padRef = useRef<Vec>({ x: 0, y: 0 });
  const speedRef = useRef(1);
  // Who went out, and what the run found for the codex.
  const characterRef = useRef<CharacterId>('keeper');
  const foundRef = useRef(new Set<string>());
  const playerRef = useRef<SoundPlayer | null>(null);
  const onPad = useCallback((direction: Vec) => {
    padRef.current = direction;
  }, []);

  const show = useCallback((next: Screen) => {
    screenRef.current = next;
    setScreen(next);
  }, []);

  const finish = useCallback(
    (how: ArenaOutcome) => {
      const arena = arenaRef.current;
      if (!arena) return;
      const time = Math.min(arena.state().time, arena.config.timeGoalMs);
      writeBest(bestOf(readBest(), time));
      const { sentHome, level } = arena.state();
      const after = applyRun(readProgress(), {
        timeMs: time,
        sentHome,
        level,
        found: [...foundRef.current],
      });
      writeProgress(after.progress);
      setResult({ time, sentHome, earned: after.earned, reached: after.reached });
      setOutcome(how);
      show('results');
    },
    [show]
  );

  const start = () => {
    const { seed, speed, boss } = testHooks();
    speedRef.current = speed;
    playerRef.current ??= sharedSoundPlayer();
    // The click that started the run is the gesture sound needs.
    playerRef.current.unlock();
    const progress = readProgress();
    characterRef.current = progress.character;
    foundRef.current = new Set();
    arenaRef.current = createArena({
      random: createRandom(seed),
      types: CAT_TYPES,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      config: {
        // His character, what the Tailor sold him, the weapons unlocked.
        ...runConfig(progress, ARENA_CONFIG),
        ...(boss === null
          ? {}
          : {
              schedule: { ...SCHEDULE, bosses: [boss, ...SCHEDULE.bosses].sort((a, b) => a - b) },
            }),
      },
    });
    setOutcome(null);
    setNotice(null);
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

    let dirty = true;
    const redraw = () => {
      dirty = true;
    };
    const sprites = CAT_TYPES.map((type) => {
      const art = catArt(type.id, 'awake');
      return art ? bitmapOf(art, CAT_SIZE * 2, redraw) : () => null;
    });
    const hero = bitmapOf(
      `data:image/svg+xml;charset=utf-8,${encodeURIComponent(HERO_SVGS[characterRef.current])}`,
      HERO_SIZE * 2,
      redraw
    );
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

    const guard = createFrameGuard(FRAME_GUARD);
    const held = new Set<string>();
    const flashes: Flash[] = [];
    const met = new Set<number>();
    const sounds: number[] = [];
    let carry = 0;
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
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(window.innerWidth * ratio);
      canvas.height = Math.round(window.innerHeight * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      arena.resize({ width: window.innerWidth, height: window.innerHeight });
      dirty = true;
    };
    resize();

    const draw = (time: number) => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const state = arena.state();
      const camX = state.hero.x - width / 2;
      const camY = state.hero.y - height / 2;
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

      // The Thunderous Vacuum's reach, and the gems lying about.
      const zone = arena.zone();
      if (zone) {
        context.fillStyle = `rgba(157, 134, 255, ${0.1 + 0.04 * Math.sin(time / 180)})`;
        context.beginPath();
        context.arc(width / 2, height / 2, zone, 0, 2 * Math.PI);
        context.fill();
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

      // The beams.
      context.strokeStyle = '#c1e838';
      context.shadowColor = '#c1e838';
      context.shadowBlur = 12;
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
        // A variety is drawn at its own size; a xenocat at the cats' size.
        const size = cat.variety ? cat.radius * 2.8 : CAT_SIZE;
        const half = size / 2;
        if (x < -size || y < -size || x > width + size || y > height + size) continue;
        const bitmap = cat.variety ? varietySprites[cat.variety]() : sprites[cat.type]();
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
        context.fillStyle = `rgba(193, 232, 56, ${(left / 300) * 0.55})`;
        context.fillRect(flash.x - camX - 8, flash.y - camY - 60, 16, 70);
      }

      // The Matriarch.
      const matriarch = arena.matriarch();
      if (matriarch && titan >= 0) {
        const size = CAT_SIZE * 4;
        const bitmap = sprites[titan]();
        context.shadowColor = '#9d86ff';
        context.shadowBlur = 30;
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

      // The Keeper, flickering while untouchable, faint under a veil.
      const keeper = hero();
      if (keeper && !(state.hero.untouchable && Math.floor(time / 90) % 2 === 0)) {
        context.save();
        context.globalAlpha = state.hero.effect === 'veil' ? 0.35 : 1;
        context.translate(width / 2, height / 2);
        if (state.hero.facing < 0) context.scale(-1, 1);
        if (state.hero.effect === 'freeze') {
          context.shadowColor = '#7dd3fc';
          context.shadowBlur = 16;
        }
        context.drawImage(keeper, -HERO_SIZE / 2, -HERO_SIZE / 2, HERO_SIZE, HERO_SIZE);
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
      carry += real * speedRef.current;
      const keys = walkDirection(held);
      const input = keys.x !== 0 || keys.y !== 0 ? keys : padRef.current;
      let steps = 0;
      while (carry >= arena.config.stepMs && steps < MAX_STEPS_PER_FRAME) {
        arena.step(input, guard.allowsSpawning());
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
        } else if (event.kind === 'boss' && titan >= 0) {
          if (player) player.play(soundsFor(CAT_TYPES[titan]).wake);
        } else if (event.kind === 'chest') {
          if (player) sound(() => player.play(soundsFor(CAT_TYPES[0]).arrive));
        } else if (event.kind === 'evolution') {
          foundRef.current.add(event.to);
          setNotice(evolutionText(event.from, event.to));
          if (player) player.play(soundsFor(CAT_TYPES[0]).wake);
        } else if (event.kind === 'secret') {
          // Nothing is said: it is simply there. The codex remembers.
          foundRef.current.add(event.id);
        } else if (event.kind === 'revived') {
          setNotice('Second Wind. He is not finished.');
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
    const onHidden = () => {
      if (document.visibilityState === 'hidden') pause();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', pause);
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('keydown', onKeyDown);
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
        Each touch of a cat wears down his Resolve. Last five minutes, and the Matriarch herself
        will come for him.
      </p>
      <p className="mt-2 max-w-2xl text-sm text-aura">
        {touch
          ? 'Walk with the pad. Tap Pause to stop for a moment.'
          : 'Walk with WASD or the arrow keys. Esc pauses.'}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <Button data-testid="survival-start" onClick={start} disabled={running}>
          {screen === 'results' ? 'Play again' : 'Start Survival'}
        </Button>
        <p data-testid="survival-best" data-best={best ?? ''} className="text-sm text-aura">
          Longest survived: {best === null ? 'none yet' : clockText(best)}
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
            {OUTCOME_TEXT[outcome]}
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-2 text-sm text-white">
            <dt className="text-aura">Time survived</dt>
            <dd data-testid="survival-result-time">{clockText(result.time)}</dd>
            <dt className="text-aura">Cats sent home</dt>
            <dd data-testid="survival-result-sent-home">{result.sentHome}</dd>
            <dt className="text-aura">Tufts of fur gathered</dt>
            <dd data-testid="survival-result-tufts">{result.earned}</dd>
          </dl>
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
          data-sent-home={hud?.sentHome ?? 0}
          data-hero-x={hud?.heroX ?? 0}
          data-hero-y={hud?.heroY ?? 0}
          data-effect={hud?.effect ?? ''}
          data-level={hud?.level ?? 1}
          data-boss={hud?.boss ? Math.round(hud.boss.homesickness) : ''}
          data-weapons={hud?.weapons ?? 'laser-pointer:1'}
          data-best-key={SURVIVAL_BEST_KEY}
          className="fixed inset-0 z-[9998] select-none overflow-hidden bg-void outline-none"
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
            <p data-testid="survival-time">
              Time {clockText(hud?.time ?? 0)} / {clockText(ARENA_CONFIG.timeGoalMs)}
            </p>
            <div className="flex items-center gap-2">
              <span id="resolve-label">Resolve</span>
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
              <span data-testid="survival-resolve">{Math.ceil(hud?.resolve ?? 100)}</span>
            </div>
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
                  Level {choiceLevel}. Choose one.
                </h2>
                <p id="level-up-help" className="mt-1 text-sm text-aura">
                  {touch
                    ? 'Tap a choice.'
                    : `Press 1 to ${choices.length}, or use the arrow keys and Enter.`}
                </p>
                <ol className="mt-4 grid gap-2">
                  {choices.map((choice, i) => {
                    const { name, description } = describeChoice(choice);
                    const kind =
                      choice.kind === 'weapon'
                        ? 'Weapon'
                        : choice.kind === 'passive'
                          ? 'Passive'
                          : 'Rest';
                    return (
                      <li key={i}>
                        <button
                          type="button"
                          data-choice={choice.kind === 'restore' ? 'restore' : choice.id}
                          data-kind={choice.kind}
                          data-level={choice.kind === 'restore' ? '' : choice.level}
                          onClick={() => choose(i)}
                          className="w-full rounded-xl border border-line bg-void/70 p-3 text-left text-sm text-white hover:border-aura focus-visible:outline focus-visible:outline-2 focus-visible:outline-plasma"
                        >
                          <span className="font-semibold text-plasma">{i + 1}.</span>{' '}
                          <span className="font-semibold">{name}</span>{' '}
                          <span className="text-aura">({kind})</span>
                          <span className="mt-1 block text-aura">{description}</span>
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
              className="absolute inset-0 z-20 flex items-center justify-center bg-void/60"
            >
              <div className="rounded-2xl border border-line bg-panel p-6 text-center">
                <h2 id="pause-heading" className="font-display text-xl text-cream">
                  Paused
                </h2>
                <p className="mt-2 text-sm text-aura">The cats wait. They are patient.</p>
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
