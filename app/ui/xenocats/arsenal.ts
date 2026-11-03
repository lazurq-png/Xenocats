// What the Keeper can carry in Survival (arena.ts): twenty weapons that fire on their
// own, up to level 8, and passives that make him or his weapons better, up to level
// 5; at most six of each in a five-minute run, more in a longer one, and no limit in
// an endless one (Slots). Each level-up offers three choices (four with the Lucky
// Bell), drawn from what he does not yet have at its highest level. A weapon at its
// highest level, held with its passive, evolves when he opens a chest (EVOLUTIONS).
// Pure data and rules, no DOM: arena.ts makes the weapons fire.

export * from './arsenal-weapons';
export * from './arsenal-rules';
export * from './arsenal-words';
