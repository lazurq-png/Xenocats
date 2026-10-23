// The arena's backdrop (arena-view.tsx draws it first, every frame): outer space.
// Stars on a few layers that slide at their own pace as the Keeper walks (the
// nearest at his own, so the ground still shows how he moves), and, in full
// graphics, a faint haze of nebulae and now and then a distant planet.
//
// Cheap to draw: every star is a small square, and where they lie comes from a hash
// of the cell they are in, so nothing is stored, nothing draws from Math.random, and
// the sky is the same each time he walks back. Light graphics (graphics.ts) keeps
// only the two nearer layers of stars: no twinkle, no haze, no planets.

/** One layer of stars: its cells (px), how fast it slides (1: with the ground), how many stars a cell. */
export type StarLayer = {
  cell: number;
  parallax: number;
  perCell: number;
  /** A star's size, px on the screen, and how bright the brightest is. */
  size: number;
  alpha: number;
  twinkle: boolean;
  /** Drawn in light graphics too. */
  inLight: boolean;
};

export const STAR_LAYERS: readonly StarLayer[] = [
  { cell: 170, parallax: 0.2, perCell: 4, size: 1.2, alpha: 0.7, twinkle: true, inLight: false },
  { cell: 220, parallax: 0.5, perCell: 3, size: 1.6, alpha: 0.85, twinkle: false, inLight: true },
  { cell: 260, parallax: 1, perCell: 1, size: 2.4, alpha: 1, twinkle: false, inLight: true },
];

/** The nebulae's cells and pace; the planets'. */
const NEBULA = { cell: 900, parallax: 0.12, chance: 0.7 };
const PLANET = { cell: 2200, parallax: 0.06, chance: 0.4 };
const NEBULA_RGB = ['157, 134, 255', '56, 189, 248', '236, 72, 153'] as const;
const PLANET_COLOURS = ['#3b3f6b', '#5b3a5e', '#2f5a63', '#6b5a3a'] as const;

/** A number in [0, 1) from three integers: the same three, the same number. */
export function hash(x: number, y: number, salt: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(salt | 0, 362437);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Star `i` of cell (cx, cy) on layer `layer`: where in the cell, px, and how bright (0–1). */
export function starAt(
  cx: number,
  cy: number,
  layer: number,
  i: number
): { x: number; y: number; bright: number } {
  const { cell } = STAR_LAYERS[layer];
  const salt = layer * 16 + i * 3;
  return {
    x: hash(cx, cy, salt) * cell,
    y: hash(cx, cy, salt + 1) * cell,
    bright: 0.35 + 0.65 * hash(cx, cy, salt + 2),
  };
}

/** The soft gradients a nebula is drawn with, made once for a context. */
const hazes = new WeakMap<CanvasRenderingContext2D, CanvasGradient[]>();
function hazeOf(context: CanvasRenderingContext2D, colour: number): CanvasGradient {
  let made = hazes.get(context);
  if (!made) {
    made = NEBULA_RGB.map((rgb) => {
      // A unit circle: drawn scaled to each nebula's size.
      const g = context.createRadialGradient(0, 0, 0, 0, 0, 1);
      g.addColorStop(0, `rgba(${rgb}, 0.26)`);
      g.addColorStop(0.5, `rgba(${rgb}, 0.1)`);
      g.addColorStop(1, `rgba(${rgb}, 0)`);
      return g;
    });
    hazes.set(context, made);
  }
  return made[colour];
}

/**
 * Draws the sky over the whole view: `width` × `height` arena px centred on the camera
 * at (camX, camY), drawn at `zoom` arena px to a screen px (so a star keeps its size on
 * the screen). `time` (ms) makes the far stars twinkle.
 */
export function drawSpace(
  context: CanvasRenderingContext2D,
  view: {
    camX: number;
    camY: number;
    width: number;
    height: number;
    zoom: number;
    time: number;
    light: boolean;
  }
) {
  const { width, height, zoom, time, light } = view;
  context.fillStyle = '#04060d';
  context.fillRect(0, 0, width, height);

  if (!light) {
    // The haze: a few great soft clouds, far off.
    for (const [cx, cy, x, y] of cellsInView(NEBULA.cell, NEBULA.parallax, view, NEBULA.cell)) {
      if (hash(cx, cy, 101) >= NEBULA.chance) continue;
      const radius = NEBULA.cell * (0.45 + 0.4 * hash(cx, cy, 102));
      context.save();
      context.translate(x + hash(cx, cy, 103) * NEBULA.cell, y + hash(cx, cy, 104) * NEBULA.cell);
      context.scale(radius, radius * (0.6 + 0.4 * hash(cx, cy, 105)));
      context.fillStyle = hazeOf(context, Math.floor(hash(cx, cy, 106) * NEBULA_RGB.length));
      context.fillRect(-1, -1, 2, 2);
      context.restore();
    }
    // Now and then a planet, further off still: lit from one side, a ring round some.
    for (const [cx, cy, x, y] of cellsInView(PLANET.cell, PLANET.parallax, view, 160)) {
      if (hash(cx, cy, 201) >= PLANET.chance) continue;
      const r = 36 + 70 * hash(cx, cy, 202);
      const px = x + PLANET.cell * (0.2 + 0.6 * hash(cx, cy, 203));
      const py = y + PLANET.cell * (0.2 + 0.6 * hash(cx, cy, 204));
      context.fillStyle = PLANET_COLOURS[Math.floor(hash(cx, cy, 205) * PLANET_COLOURS.length)];
      context.beginPath();
      context.arc(px, py, r, 0, 2 * Math.PI);
      context.fill();
      // Its night side: the sky's own colour, over most of it.
      context.fillStyle = 'rgba(4, 6, 13, 0.6)';
      context.beginPath();
      context.arc(px + r * 0.35, py + r * 0.25, r * 0.95, 0, 2 * Math.PI);
      context.fill();
      if (hash(cx, cy, 206) < 0.4) {
        context.strokeStyle = 'rgba(239, 227, 200, 0.25)';
        context.lineWidth = 2 * zoom;
        context.beginPath();
        context.ellipse(px, py, r * 1.7, r * 0.45, -0.35, 0, 2 * Math.PI);
        context.stroke();
      }
    }
  }

  // The stars, far to near.
  STAR_LAYERS.forEach((layer, index) => {
    if (light && !layer.inLight) return;
    const size = layer.size * zoom;
    context.fillStyle = '#efe3c8';
    for (const [cx, cy, x, y] of cellsInView(layer.cell, layer.parallax, view, 0)) {
      for (let i = 0; i < layer.perCell; i++) {
        const star = starAt(cx, cy, index, i);
        let alpha = layer.alpha * star.bright;
        if (layer.twinkle) alpha *= 0.65 + 0.35 * Math.sin(time / 600 + star.bright * 40);
        context.globalAlpha = alpha;
        context.fillRect(x + star.x, y + star.y, size, size);
      }
    }
  });
  context.globalAlpha = 1;
}

/**
 * The cells of a layer that show (with `pad` px more on each side, for what spills out
 * of its cell): each as [cx, cy, x, y], (x, y) its corner in the view's px.
 */
function* cellsInView(
  cell: number,
  parallax: number,
  view: { camX: number; camY: number; width: number; height: number },
  pad: number
): Generator<[number, number, number, number]> {
  // Where the view's top left corner is in the layer, which slides at its own pace.
  const left = view.camX * parallax - view.width / 2;
  const top = view.camY * parallax - view.height / 2;
  const fromX = Math.floor((left - pad) / cell);
  const toX = Math.floor((left + view.width + pad) / cell);
  const fromY = Math.floor((top - pad) / cell);
  const toY = Math.floor((top + view.height + pad) / cell);
  for (let cy = fromY; cy <= toY; cy++) {
    for (let cx = fromX; cx <= toX; cx++) yield [cx, cy, cx * cell - left, cy * cell - top];
  }
}
