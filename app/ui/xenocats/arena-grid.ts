// A spatial grid for the Survival arena (arena.ts): the world cut into square
// cells, each holding the ids of what stands in it, so "who is near this point" asks
// a few cells instead of every cat. Rebuilt every step; its cell lists are reused,
// not reallocated. Pure, no DOM.

export type ArenaGrid = ReturnType<typeof createArenaGrid>;

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

  return {
    cellSize,

    clear() {
      for (const list of used) list.length = 0;
      used.length = 0;
    },

    insert(id: number, x: number, y: number) {
      const k = key(Math.floor(x / cellSize), Math.floor(y / cellSize));
      let list = cells.get(k);
      if (!list) {
        list = [];
        cells.set(k, list);
      }
      if (list.length === 0) used.push(list);
      list.push(id);
    },

    /**
     * The ids in every cell within `radius` of (x, y), into `out` (emptied first).
     * A superset of what is truly within `radius`: the caller checks distances.
     */
    query(x: number, y: number, radius: number, out: number[]): number[] {
      out.length = 0;
      const x0 = Math.floor((x - radius) / cellSize);
      const x1 = Math.floor((x + radius) / cellSize);
      const y0 = Math.floor((y - radius) / cellSize);
      const y1 = Math.floor((y + radius) / cellSize);
      for (let cx = x0; cx <= x1; cx++) {
        for (let cy = y0; cy <= y1; cy++) {
          const list = cells.get(key(cx, cy));
          if (list) for (const id of list) out.push(id);
        }
      }
      return out;
    },
  };
}
