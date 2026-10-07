// What Survival keeps from run to run: the tufts each run gathers, what the Tailor
// has sold him, the milestones reached (which unlock weapons and characters), the
// character chosen, and what the codex has found. Pure rules, plus the storage they
// live in (localStorage, one versioned key; anything unreadable is a fresh start).

import type { ArenaConfig } from './arena';
import { BASE_WEAPONS, EVOLUTIONS, WEAPONS, type WeaponId } from './arsenal';
import { VARIETIES } from './varieties';

export const PROGRESS_KEY = 'xenocats:survival:v1:progress';
export const PROGRESS_VERSION = 1;

/** What one run did, as the progression sees it. */
export type RunResult = {
  timeMs: number;
  sentHome: number;
  level: number;
  /** Codex entries met in the run: evolved weapons' ids, the secret cat's. */
  found: readonly string[];
};

// ------------------------------------------------------------------ the tufts

/** Tufts a run gathers: one for every 5 s survived, one for every 20 cats sent home. */
export function tuftsFor(run: Pick<RunResult, 'timeMs' | 'sentHome'>): number {
  return Math.floor(Math.max(run.timeMs, 0) / 5000) + Math.floor(Math.max(run.sentHome, 0) / 20);
}

// ----------------------------------------------------------------- milestones

export type MilestoneId = 'survive-2' | 'survive-3' | 'send-1000' | 'level-20';

export const MILESTONES: Readonly<
  Record<MilestoneId, { text: string; reached: (run: RunResult) => boolean }>
> = {
  'survive-2': { text: 'Survive 2:00', reached: (run) => run.timeMs >= 120_000 },
  'survive-3': { text: 'Survive 3:00', reached: (run) => run.timeMs >= 180_000 },
  'send-1000': { text: 'Send 1000 cats home in one run', reached: (run) => run.sentHome >= 1000 },
  'level-20': { text: 'Reach level 20', reached: (run) => run.level >= 20 },
};

/** Weapons kept from him until a milestone; any other base weapon is his from the start. */
export const WEAPON_UNLOCKS: Readonly<Partial<Record<WeaponId, MilestoneId>>> = {
  'thunderous-vacuum': 'survive-3',
  'laser-pointer-deluxe': 'send-1000',
  hairball: 'level-20',
};

/** What a milestone unlocks, in a sentence (or nothing). */
export function unlockedBy(id: MilestoneId): string {
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

// ------------------------------------------------------------------ the Tailor

export type UpgradeId = 'stubbornness' | 'sternness' | 'brisk-step' | 'long-arms' | 'second-wind';

export const UPGRADES: Readonly<
  Record<UpgradeId, { name: string; description: string; maxLevel: number; baseCost: number }>
> = {
  stubbornness: {
    name: 'Stubbornness',
    description: 'He begins every run with 10 more Resolve.',
    maxLevel: 5,
    baseCost: 10,
  },
  sternness: {
    name: 'Sternness',
    description: 'Everything he does makes a cat 5% more homesick.',
    maxLevel: 5,
    baseCost: 15,
  },
  'brisk-step': {
    name: 'Brisk Step',
    description: 'He walks 4% faster.',
    maxLevel: 5,
    baseCost: 12,
  },
  'long-arms': {
    name: 'Long Arms',
    description: 'He gathers experience from 10% further off.',
    maxLevel: 3,
    baseCost: 10,
  },
  'second-wind': {
    name: 'Second Wind',
    description: 'Once a run, when his Resolve is spent, half of it returns.',
    maxLevel: 1,
    baseCost: 80,
  },
};

/** The next level of an upgrade costs more each time; null once it is at its highest. */
export function upgradeCost(id: UpgradeId, level: number): number | null {
  const upgrade = UPGRADES[id];
  if (level >= upgrade.maxLevel) return null;
  return Math.round(upgrade.baseCost * 1.7 ** level);
}

// ------------------------------------------------------------------ characters

export type CharacterId = 'keeper' | 'night-porter' | 'housekeeper';

export type Character = {
  name: string;
  description: string;
  weapon: WeaponId;
  /** Added to his Resolve. */
  resolve: number;
  /** Times his pace. */
  speed: number;
  /** How he is had: from the start, a milestone, or bought. */
  unlock:
    | { kind: 'free' }
    | { kind: 'milestone'; milestone: MilestoneId }
    | { kind: 'cost'; cost: number };
};

export const CHARACTERS: Readonly<Record<CharacterId, Character>> = {
  keeper: {
    name: 'The Keeper',
    description: 'A long coat and a Laser Pointer. He only wishes them home.',
    weapon: 'laser-pointer',
    resolve: 0,
    speed: 1,
    unlock: { kind: 'free' },
  },
  'night-porter': {
    name: 'The Night Porter',
    description: 'Quick on the stairs, a Spray Bottle in hand; less Resolve than he admits.',
    weapon: 'spray-bottle',
    resolve: -15,
    speed: 1.12,
    unlock: { kind: 'milestone', milestone: 'survive-2' },
  },
  housekeeper: {
    name: 'The Housekeeper',
    description: 'Unhurried, unmoved, and never without the Vacuum Cleaner.',
    weapon: 'vacuum-cleaner',
    resolve: 30,
    speed: 0.92,
    unlock: { kind: 'cost', cost: 150 },
  },
};

// ------------------------------------------------------------------- the codex

/** The secret cat: comes only to a Keeper who stands still (decisions.md, D60). */
export const SECRET_CAT = 'neighbour';

/** The codex's entries, in order: every evolution (one of them hidden) and the secret cat. */
export const CODEX: readonly { id: string; name: string }[] = [
  ...EVOLUTIONS.map((e) => ({ id: e.to, name: WEAPONS[e.to].name })),
  { id: SECRET_CAT, name: VARIETIES[SECRET_CAT].name },
];

// ------------------------------------------------------------------- progress

export type Progress = {
  tufts: number;
  upgrades: Readonly<Partial<Record<UpgradeId, number>>>;
  milestones: readonly MilestoneId[];
  /** Characters bought (those had by milestone or from the start are not listed). */
  bought: readonly CharacterId[];
  character: CharacterId;
  /** Codex entries found. */
  found: readonly string[];
};

export function freshProgress(): Progress {
  return { tufts: 0, upgrades: {}, milestones: [], bought: [], character: 'keeper', found: [] };
}

const isIn = <K extends string>(record: Readonly<Record<K, unknown>>, key: unknown): key is K =>
  typeof key === 'string' && Object.prototype.hasOwnProperty.call(record, key);

const CODEX_IDS = new Set(CODEX.map((entry) => entry.id));

/**
 * Stored progress, or a fresh start for anything missing, corrupt, of another
 * version, or not sane. Never throws. Unknown entries are dropped one by one.
 */
export function parseProgress(raw: string | null): Progress {
  const fresh = freshProgress();
  if (raw === null) return fresh;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return fresh;
  }
  if (typeof data !== 'object' || data === null) return fresh;
  const d = data as Record<string, unknown>;
  // Only this version is read: an older or newer one starts afresh, cleanly.
  if (d.version !== PROGRESS_VERSION) return fresh;
  const list = (value: unknown) => (Array.isArray(value) ? value : []);
  const upgrades: Partial<Record<UpgradeId, number>> = {};
  if (typeof d.upgrades === 'object' && d.upgrades !== null) {
    for (const [id, level] of Object.entries(d.upgrades)) {
      if (isIn(UPGRADES, id) && Number.isInteger(level) && (level as number) > 0) {
        upgrades[id] = Math.min(level as number, UPGRADES[id].maxLevel);
      }
    }
  }
  const tufts = Number(d.tufts);
  const progress: Progress = {
    tufts: Number.isInteger(tufts) && tufts >= 0 && tufts < 1e9 ? tufts : 0,
    upgrades,
    milestones: [...new Set(list(d.milestones).filter((m) => isIn(MILESTONES, m)))],
    bought: [...new Set(list(d.bought).filter((c) => isIn(CHARACTERS, c)))],
    character: isIn(CHARACTERS, d.character) ? d.character : 'keeper',
    found: [...new Set(list(d.found).filter((f) => typeof f === 'string' && CODEX_IDS.has(f)))],
  };
  // A character he no longer has (say, a hand-edited store) is not his to choose.
  if (!hasCharacter(progress, progress.character)) progress.character = 'keeper';
  return progress;
}

export function serializeProgress(progress: Progress): string {
  return JSON.stringify({ version: PROGRESS_VERSION, ...progress });
}

/** The progress after a run: its tufts, milestones newly reached, entries found. */
export function applyRun(
  progress: Progress,
  run: RunResult
): { progress: Progress; earned: number; reached: MilestoneId[] } {
  const earned = tuftsFor(run);
  const reached = (Object.keys(MILESTONES) as MilestoneId[]).filter(
    (id) => !progress.milestones.includes(id) && MILESTONES[id].reached(run)
  );
  return {
    earned,
    reached,
    progress: {
      ...progress,
      tufts: progress.tufts + earned,
      milestones: [...progress.milestones, ...reached],
      found: [...new Set([...progress.found, ...run.found.filter((f) => CODEX_IDS.has(f))])],
    },
  };
}

/** Buys the next level of an upgrade; null if it is at its highest or he cannot pay. */
export function buyUpgrade(progress: Progress, id: UpgradeId): Progress | null {
  const level = progress.upgrades[id] ?? 0;
  const cost = upgradeCost(id, level);
  if (cost === null || cost > progress.tufts) return null;
  return {
    ...progress,
    tufts: progress.tufts - cost,
    upgrades: { ...progress.upgrades, [id]: level + 1 },
  };
}

export function hasCharacter(progress: Progress, id: CharacterId): boolean {
  const unlock = CHARACTERS[id].unlock;
  if (unlock.kind === 'free') return true;
  if (unlock.kind === 'milestone') return progress.milestones.includes(unlock.milestone);
  return progress.bought.includes(id);
}

/** Buys a character sold for tufts; null if not for sale, had already, or he cannot pay. */
export function buyCharacter(progress: Progress, id: CharacterId): Progress | null {
  const unlock = CHARACTERS[id].unlock;
  if (unlock.kind !== 'cost' || hasCharacter(progress, id) || unlock.cost > progress.tufts) {
    return null;
  }
  return { ...progress, tufts: progress.tufts - unlock.cost, bought: [...progress.bought, id] };
}

/** Chooses a character he has; anyone else leaves the choice as it was. */
export function chooseCharacter(progress: Progress, id: CharacterId): Progress {
  return hasCharacter(progress, id) ? { ...progress, character: id } : progress;
}

/** The base weapons a level-up may offer him: those no milestone still keeps from him. */
export function availableWeapons(progress: Progress): WeaponId[] {
  return BASE_WEAPONS.filter((id) => {
    const milestone = WEAPON_UNLOCKS[id];
    return milestone === undefined || progress.milestones.includes(milestone);
  });
}

/** The codex: each entry's name once found, "???" until then. */
export function codexEntries(progress: Progress): { id: string; name: string; found: boolean }[] {
  return CODEX.map((entry) => {
    const found = progress.found.includes(entry.id);
    return { id: entry.id, name: found ? entry.name : '???', found };
  });
}

/** A Keeper going out as `id`, with the Tailor's work: his weapon, Resolve and pace. */
function keeperFor(progress: Progress, id: CharacterId, base: ArenaConfig) {
  const character = CHARACTERS[id];
  const level = (u: UpgradeId) => progress.upgrades[u] ?? 0;
  return {
    startingWeapons: [character.weapon],
    resolve: Math.max(base.hero.resolve + character.resolve + 10 * level('stubbornness'), 1),
    speed: base.hero.speed * character.speed * (1 + 0.04 * level('brisk-step')),
  };
}

/**
 * What a run starts with: his character, what the Tailor sold him, what is
 * unlocked; and in co-op, player 2 going out as `second` (a character player 1 has).
 */
export function runConfig(
  progress: Progress,
  base: ArenaConfig,
  second: CharacterId | null = null
): Partial<ArenaConfig> {
  const level = (id: UpgradeId) => progress.upgrades[id] ?? 0;
  const one = keeperFor(progress, progress.character, base);
  return {
    startingWeapons: one.startingWeapons,
    availableWeapons: availableWeapons(progress),
    hero: { ...base.hero, resolve: one.resolve, speed: one.speed },
    boost: {
      might: 1 + 0.05 * level('sternness'),
      pickup: 1 + 0.1 * level('long-arms'),
      revivals: level('second-wind'),
    },
    secondPlayer:
      second === null
        ? null
        : keeperFor(progress, hasCharacter(progress, second) ? second : 'keeper', base),
  };
}

// --------------------------------------------------------------------- storage

let cache: { raw: string | null; progress: Progress } | null = null;
const listeners = new Set<() => void>();

/** The stored progress (the same object while the store is unchanged). */
export function readProgress(): Progress {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(PROGRESS_KEY);
  } catch {
    // Storage blocked: a fresh start, every time.
  }
  if (!cache || cache.raw !== raw) cache = { raw, progress: parseProgress(raw) };
  return cache.progress;
}

export function writeProgress(progress: Progress) {
  try {
    window.localStorage.setItem(PROGRESS_KEY, serializeProgress(progress));
  } catch {
    // Storage blocked or full: the progress just isn't kept.
  }
  for (const listener of listeners) listener();
}

/** For useSyncExternalStore: this tab's writes and other tabs'. */
export function subscribeProgress(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener('storage', onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
}

const SERVER_PROGRESS = freshProgress();
export const serverProgress = () => SERVER_PROGRESS;
