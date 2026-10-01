// Every timing and size the cats use, in one place. Ranges are [min, max) in ms.

export type Range = readonly [number, number];

export type CatConfig = {
  /** Never more cats on screen than this, whatever their phase. */
  maxCats: number;
  /** A cat's drawn width and height, px. */
  catSize: number;
  /** Cats keep this far from the viewport's edges, px. */
  margin: number;
  /** A new cat never appears with its centre closer than this to the cursor, px. */
  keepAwayFromCursor: number;
  /** Delay before the first cat on a page. */
  firstSpawnMs: Range;
  /** Delay between later spawn attempts. */
  spawnEveryMs: Range;
  /** How long a cat sleeps before it wakes. */
  sleepMs: Range;
  /** The waking stretch before a cat is ready to attack. */
  wakeMs: number;
  /** The pounce animation once the attack has started. */
  attackMs: number;
  /** An attack also hits page elements this close to the pointer, px. */
  pageHitRadius: number;
  /** At most this many page elements per attack. */
  maxPageTargets: number;
};

export const CAT_CONFIG: CatConfig = {
  maxCats: 5,
  catSize: 72,
  margin: 8,
  keepAwayFromCursor: 140,
  firstSpawnMs: [3000, 7000],
  spawnEveryMs: [7000, 16000],
  sleepMs: [8000, 22000],
  wakeMs: 900,
  attackMs: 600,
  pageHitRadius: 120,
  maxPageTargets: 6,
};
