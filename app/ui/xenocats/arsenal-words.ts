// Survival's arsenal (arsenal.ts): the words for it, what a choice or a loadout
// says it does. Split out of arsenal.ts, which re-exports all of it, so a module
// may import it from either.

import {
  MAX_WEAPON_LEVEL,
  type Slots,
  DEFAULT_SLOTS,
  type WeaponId,
  type PassiveId,
  type WeaponKind,
  WEAPONS,
} from './arsenal-weapons';
import {
  EVOLUTIONS,
  FUSIONS,
  BASE_WEAPONS,
  absorbedBy,
  passivesIn,
  evolutionFor,
  PASSIVES,
  type Modifiers,
  modifiers,
  type Choice,
} from './arsenal-rules';

const percent = (after: number, before: number) => Math.round((after / before - 1) * 100);

/** What a weapon's area is, in its level-up card's words. */
const AREA_WORD: Readonly<Record<WeaponKind, string>> = {
  beam: 'reach',
  chain: 'reach',
  web: 'reach',
  pull: 'reach',
  gulp: 'reach',
  zone: 'reach',
  orbit: 'reach',
  spread: 'size',
  bounce: 'size',
  burst: 'size',
  arc: 'range',
  sweep: 'reach',
  lure: 'size',
  trap: 'size',
  blow: 'reach',
  boomerang: 'size',
  swat: 'reach',
  cling: 'reach',
  scare: 'size',
  fused: 'reach',
};

/** What a weapon's speed is, in its level-up card's words. */
const SPEED_WORD: Partial<Record<WeaponKind, string>> = {
  pull: 'pull',
  orbit: 'turning speed',
  sweep: 'knockback',
  lure: 'squeak range',
  blow: 'push',
  swat: 'knockback',
};

/**
 * What `level` of a weapon adds to the level before it: one phrase for each stat it
 * changes, and nothing for one it does not ("+1 beam", "+40% homesickness"). Read
 * from the stats themselves, so a card and what the level does cannot disagree.
 * Level 1 (and an evolved weapon, which does not grow) adds nothing.
 */
export function levelChanges(id: WeaponId, level: number): string[] {
  const { levels, kind, unit } = WEAPONS[id];
  if (level < 2 || level > levels.length) return [];
  const before = levels[level - 2];
  const after = levels[level - 1];
  const changes: string[] = [];
  const more = (n: number, one: string) => `+${n} ${one}${n === 1 ? '' : 's'}`;
  if (after.count !== before.count) changes.push(more(after.count - before.count, unit));
  if (after.damage !== before.damage) {
    changes.push(`+${percent(after.damage, before.damage)}% homesickness`);
  }
  if (after.cooldownMs !== before.cooldownMs) {
    changes.push(`fires ${-percent(after.cooldownMs, before.cooldownMs)}% sooner`);
  }
  if (after.area !== before.area) {
    changes.push(`+${percent(after.area, before.area)}% ${AREA_WORD[kind]}`);
  }
  if (after.speed !== before.speed) {
    const word = SPEED_WORD[kind] ?? 'speed';
    changes.push(`+${percent(after.speed, before.speed)}% ${word}`);
  }
  if (after.durationMs !== before.durationMs) {
    changes.push(`lasts ${percent(after.durationMs, before.durationMs)}% longer`);
  }
  if (after.pierce !== before.pierce) {
    const n = after.pierce - before.pierce;
    changes.push(
      `${kind === 'trap' ? 'holds' : 'passes through'} ${n} more cat${n === 1 ? '' : 's'}`
    );
  }
  return changes;
}

const tenth = (n: number) => Math.round(n * 10) / 10;

/** The kinds whose count means nothing to the arena: the vacuums pull and hum as one. */
const UNCOUNTED: readonly WeaponKind[] = ['pull', 'zone', 'gulp'];

/** What Scissors adds one of, in the cards' words: "beam, treat, … or jump". */
const COUNTED = (() => {
  const units = [
    ...new Set(
      BASE_WEAPONS.filter((id) => !UNCOUNTED.includes(WEAPONS[id].kind)).map(
        (id) => WEAPONS[id].unit
      )
    ),
  ];
  return `${units.slice(0, -1).join(', ')} or ${units[units.length - 1]}`;
})();

/** Each of the passives' modifiers, as a level-up card says what one step of it adds. */
const MODIFIER_WORDS: { [K in keyof Modifiers]: (step: number) => string } = {
  speed: (step) => `+${Math.round(step * 100)}% walking speed`,
  cooldown: (step) => `weapons ready ${Math.round(-step * 100)}% sooner`,
  area: (step) => `+${Math.round(step * 100)}% weapon reach`,
  count: (step) => `+${step} ${COUNTED} for each weapon that fires them`,
  maxResolve: (step) => `+${step} Resolve`,
  recovery: (step) => `+${tenth(step)} Resolve a second`,
  pickup: (step) => `+${Math.round(step * 100)}% pickup reach`,
  might: (step) => `+${Math.round(step * 100)}% homesickness`,
  choices: (step) => `+${step} choice at every level`,
  duration: (step) => `what his weapons make lasts ${Math.round(step * 100)}% longer`,
  pierce: (step) => `+${step} cat through each shot, and in each carton`,
  grace: (step) => `untouchable ${Math.round(step)} ms longer after a hit`,
  xp: (step) => `+${Math.round(step * 100)}% experience from gems`,
  guard: (step) => `elite effects on him last ${Math.round(step * 100)}% shorter`,
  velocity: (step) => `what his weapons throw flies ${Math.round(step * 100)}% faster`,
  drain: (step) => `cats drain ${Math.round(-step * 100)}% less Resolve`,
  elite: (step) => `+${Math.round(step * 100)}% homesickness to elites and Mega Cats`,
  luck: (step) => `cats leave pickups ${Math.round(step * 100)}% more often`,
  levelHeal: (step) => `+${tenth(step)} Resolve at every level`,
  rerolls: (step) => `+${step} reroll${step === 1 ? '' : 's'}`,
};

/**
 * What `level` of a passive adds to the level before it (level 1: to having none),
 * read from `modifiers` itself. Every level of a passive adds the same.
 */
export function passiveChanges(id: PassiveId, level: number): string[] {
  if (level < 1 || level > PASSIVES[id].maxLevel) return [];
  const before = modifiers(new Map(level > 1 ? [[id, level - 1]] : []));
  const after = modifiers(new Map([[id, level]]));
  return (Object.keys(MODIFIER_WORDS) as (keyof Modifiers)[])
    .filter((key) => Math.abs(after[key] - before[key]) > 1e-9)
    .map((key) => MODIFIER_WORDS[key](after[key] - before[key]));
}

/**
 * A choice's name, its line in the game's voice, and what taking it changes (none
 * for a new weapon: its line says what it does), for the level-up dialog.
 */
export function describeChoice(choice: Choice): {
  name: string;
  description: string;
  change: string | null;
} {
  const info = choice.kind === 'weapon' ? WEAPONS[choice.id] : PASSIVES[choice.id];
  const changes =
    choice.kind === 'weapon'
      ? levelChanges(choice.id, choice.level)
      : passiveChanges(choice.id, choice.level);
  return {
    name: choice.level === 1 ? info.name : `${info.name}, level ${choice.level}`,
    description: info.description,
    change: changes.length > 0 ? `${capitalise(changes.join(', '))}.` : null,
  };
}

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** What a passive at `level` gives in all, read from `modifiers` (e.g. "+20% walking speed"). */
export function passiveTotal(id: PassiveId, level: number): string[] {
  if (level < 1) return [];
  const none = modifiers(new Map());
  const held = modifiers(new Map([[id, Math.min(level, PASSIVES[id].maxLevel)]]));
  return (Object.keys(MODIFIER_WORDS) as (keyof Modifiers)[])
    .filter((key) => Math.abs(held[key] - none[key]) > 1e-9)
    .map((key) => MODIFIER_WORDS[key](held[key] - none[key]));
}

/** What a Keeper carries, as the pause menu shows it. */
export type Loadout = {
  weapons: {
    id: WeaponId;
    name: string;
    level: number;
    /** An evolved weapon does not grow: its highest level is the one it has. */
    maxLevel: number;
    evolved: boolean;
    /** What the next level adds (levelChanges), or null at the top or evolved. */
    next: string | null;
    /** The passives an evolved (or fused) weapon took in, at their highest level, and what they give. */
    includes: { id: PassiveId; name: string; gives: string }[];
  }[];
  /** Infinity in a run with no limit; so is freePassiveSlots. */
  freeWeaponSlots: number;
  passives: { id: PassiveId; name: string; level: number; maxLevel: number; gives: string }[];
  freePassiveSlots: number;
  /**
   * Each evolution within reach, not yet made: he holds its weapon and its passive, and
   * one of the two is at its highest level. What is still missing (the weapon's last
   * levels), or, with nothing missing, `ready` for the one the next chest
   * evolves (evolutionFor: the first ready, in EVOLUTIONS' order) and `after` naming
   * it for any other ready one. A secret one is never named here: the codex keeps it
   * until it is found.
   */
  evolutions: {
    from: WeaponId;
    with: PassiveId;
    to: WeaponId;
    missing: string[];
    ready: boolean;
    after: WeaponId | null;
  }[];
  /**
   * Each fusion within reach, not yet made: he holds one of its two evolved weapons, and
   * the other too or its evolution is within reach. What is still missing, or `ready`
   * when both are held (the next chest fuses them).
   */
  fusions: {
    from: readonly [WeaponId, WeaponId];
    to: WeaponId;
    missing: string[];
    ready: boolean;
  }[];
};

export function loadout(
  weapons: readonly { id: WeaponId; level: number }[],
  passives: readonly { id: PassiveId; level: number }[],
  slots: Slots = DEFAULT_SLOTS
): Loadout {
  const weaponLevels = new Map(weapons.map((w) => [w.id, w.level] as const));
  const passiveLevels = new Map(passives.map((p) => [p.id, p.level] as const));
  const evolvedIds = new Set<WeaponId>([
    ...EVOLUTIONS.map((e) => e.to),
    ...FUSIONS.map((f) => f.to),
  ]);
  const absorbed = absorbedBy(weaponLevels);
  // What the next chest evolves, by the chest's own rule.
  const first = evolutionFor(weaponLevels, passiveLevels);
  // Within reach: not made yet, both halves held, and one of them at its highest level.
  const nearEvolutions = EVOLUTIONS.filter((e) => {
    const level = weaponLevels.get(e.from);
    const with_ = passiveLevels.get(e.with);
    return (
      !e.secret &&
      !weaponLevels.has(e.to) &&
      !absorbed.has(e.to) &&
      level !== undefined &&
      with_ !== undefined &&
      (level >= MAX_WEAPON_LEVEL || with_ >= PASSIVES[e.with].maxLevel)
    );
  });
  const near = new Set(nearEvolutions.map((e) => e.to));
  return {
    weapons: weapons.map(({ id, level }) => {
      const evolved = evolvedIds.has(id);
      const maxLevel = evolved ? level : MAX_WEAPON_LEVEL;
      const changes = evolved || level >= maxLevel ? [] : levelChanges(id, level + 1);
      return {
        id,
        name: WEAPONS[id].name,
        level,
        maxLevel,
        evolved,
        next: changes.length > 0 ? `${capitalise(changes.join(', '))}.` : null,
        includes: passivesIn(id).map((p) => ({
          id: p,
          name: PASSIVES[p].name,
          gives: `${capitalise(passiveTotal(p, PASSIVES[p].maxLevel).join(', '))}.`,
        })),
      };
    }),
    freeWeaponSlots: Math.max(slots.weapons - weapons.length, 0),
    passives: passives.map(({ id, level }) => ({
      id,
      name: PASSIVES[id].name,
      level,
      maxLevel: PASSIVES[id].maxLevel,
      gives: `${capitalise(passiveTotal(id, level).join(', '))}.`,
    })),
    freePassiveSlots: Math.max(slots.passives - passives.length, 0),
    fusions: FUSIONS.filter(
      (f) =>
        !weaponLevels.has(f.to) &&
        f.from.some((id) => weaponLevels.has(id)) &&
        f.from.every((id) => weaponLevels.has(id) || near.has(id))
    ).map((f) => {
      const missing = f.from
        .filter((id) => !weaponLevels.has(id))
        .map((id) => `the ${WEAPONS[id].name}`);
      return { from: f.from, to: f.to, missing, ready: missing.length === 0 };
    }),
    evolutions: nearEvolutions.map((e) => {
      const level = weaponLevels.get(e.from)!;
      const missing =
        level < MAX_WEAPON_LEVEL
          ? [`the ${WEAPONS[e.from].name} at level ${MAX_WEAPON_LEVEL} (now ${level})`]
          : [];
      const done = missing.length === 0;
      return {
        from: e.from,
        with: e.with,
        to: e.to,
        missing,
        ready: done && first?.to === e.to,
        after: done && first && first.to !== e.to ? first.to : null,
      };
    }),
  };
}

/** A fusion, announced with due gravity. */
export function fusionText(from: readonly [WeaponId, WeaponId], to: WeaponId): string {
  return `${the(WEAPONS[from[0]].name, 'The')} and ${the(WEAPONS[from[1]].name, 'the')} are one. In their place: ${the(WEAPONS[to].name, 'the')}.`;
}

/** An evolution, announced with due gravity. */
export function evolutionText(from: WeaponId, to: WeaponId): string {
  return `${the(WEAPONS[from].name, 'The')} is no more. In its place: ${the(WEAPONS[to].name, 'the')}.`;
}

/** A name with its article ("the Yarn Ball"), unless it brings its own ("The Matriarch"). */
export const the = (name: string, article: 'The' | 'the') =>
  /^The /.test(name) ? name : `${article} ${name}`;
