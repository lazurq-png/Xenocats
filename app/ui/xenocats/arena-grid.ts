// A spatial grid for the Survival arena (arena.ts): the world cut into square
// cells, each holding the ids of what stands in it, so "who is near this point" asks
// a few cells instead of every cat. Rebuilt every step; its cell lists are reused,
// not reallocated. Pure, no DOM.

export type ArenaGrid = ReturnType<typeof createArenaGrid>;

/** A square of the world, centred on (x, y), reaching `half` each way. */
export type GridWindow = { x: number; y: number; half: number };

/** The most cells a window's array may hold; a larger window is not kept in one. */
const MOST_WINDOW_CELLS = 1 << 16;

export function createArenaGrid(cellSize: number) {
  const cells = new Map<number, number[]>();
  /** The lists in use this step; emptied (not dropped) by `clear`. */
  const used: number[][] = [];
  // Cell coordinates packed into one small integer (under 2^30, which V8 keeps
  // unboxed: a Map hashes it far faster than the double it was), 15 bits each. Cells
  // 32,768 apart share a key, so a list may hold ids from a far cell too: harmless,
  // since a query's answer is a superset its caller checks by distance anyway, and
  // never the case for two points less than about two million px apart (so not
  // within about a million px of where the run began).
  const key = (cx: number, cy: number) => ((cx & 0x7fff) << 15) | (cy & 0x7fff);

  // The cells of the window `clear` was given, in an array (no hashing): the arena
  // keeps every cat within a reach of the camera, so nearly every insert and look-up
  // lands here. A cell outside it is in the Map as before. Each cell has one list
  // either way, filled in the order of insertion, so a query gives the same ids in the
  // same order as the Map alone did (but for ids from a cell 32,768 cells away, which
  // shared its key there: no caller keeps those, being beyond its distance check).
  const windowCells: (number[] | undefined)[] = [];
  let x0 = 0;
  let y0 = 0;
  let cols = 0;
  let rows = 0;

  /** The list of cell (cx, cy), made if `make`; undefined if it has none. */
  function listOf(cx: number, cy: number, make: boolean): number[] | undefined {
    const dx = cx - x0;
    const dy = cy - y0;
    if (dx >= 0 && dx < cols && dy >= 0 && dy < rows) {
      const at = dx + dy * cols;
      let list = windowCells[at];
      if (!list && make) {
        list = [];
        windowCells[at] = list;
      }
      return list;
    }
    const k = key(cx, cy);
    let list = cells.get(k);
    if (!list && make) {
      list = [];
      cells.set(k, list);
    }
    return list;
  }

  return {
    cellSize,

    /** Empties every cell; `window`, if given, is where this step's points will lie. */
    clear(window?: GridWindow) {
      for (const list of used) list.length = 0;
      used.length = 0;
      cols = rows = 0;
      if (!window) return;
      const cx0 = Math.floor((window.x - window.half) / cellSize);
      const cy0 = Math.floor((window.y - window.half) / cellSize);
      const width = Math.floor((window.x + window.half) / cellSize) - cx0 + 1;
      const height = Math.floor((window.y + window.half) / cellSize) - cy0 + 1;
      // A window too large (or not a number) is not kept: the Map holds it all.
      if (!(width * height <= MOST_WINDOW_CELLS)) return;
      x0 = cx0;
      y0 = cy0;
      cols = width;
      rows = height;
      // The lists already in the array are empty (above) and serve any cell now.
    },

    insert(id: number, x: number, y: number) {
      const list = listOf(Math.floor(x / cellSize), Math.floor(y / cellSize), true)!;
      if (list.length === 0) used.push(list);
      list.push(id);
    },

    /**
     * The ids in every cell within `radius` of (x, y), into `out` (emptied first).
     * A superset of what is truly within `radius`: the caller checks distances.
     */
    query(x: number, y: number, radius: number, out: number[]): number[] {
      out.length = 0;
      const left = Math.floor((x - radius) / cellSize);
      const right = Math.floor((x + radius) / cellSize);
      const top = Math.floor((y - radius) / cellSize);
      const bottom = Math.floor((y + radius) / cellSize);
      for (let cx = left; cx <= right; cx++) {
        for (let cy = top; cy <= bottom; cy++) {
          const list = listOf(cx, cy, false);
          if (list) for (const id of list) out.push(id);
        }
      }
      return out;
    },
  };
}
