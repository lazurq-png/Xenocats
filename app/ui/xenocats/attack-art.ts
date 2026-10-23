// How the arena view (arena-view.tsx) draws the cats' attacks and their rare ones:
// the warnings while an attack winds up (arena.ts, telegraphs), the shots the cats
// fire, and the mark that keeps an elite or a visiting xenocat seen in a crowd. Each
// is a few plain shapes: no shadow blur, which costs the most to draw.

import type { EnemyShot, Telegraph } from './arena';

/** An elite's colour, a boss's, and a visiting xenocat's (one that is no elite). */
const ELITE = '244, 114, 182';
const BOSS = '251, 146, 60';
const VISITOR = '251, 191, 36';

/** Draws one attack winding up, where it will go, filling as the moment nears. */
export function drawTelegraph(
  context: CanvasRenderingContext2D,
  w: Telegraph,
  camX: number,
  camY: number
) {
  const rgb = w.boss ? BOSS : ELITE;
  const x = w.x - camX;
  const y = w.y - camY;
  const angle = Math.atan2(w.aimY - w.y, w.aimX - w.x);
  context.fillStyle = `rgba(${rgb}, ${0.08 + 0.22 * w.progress})`;
  context.strokeStyle = `rgba(${rgb}, 0.85)`;
  context.lineWidth = 2;
  if (w.shape === 'blast') {
    const ax = w.aimX - camX;
    const ay = w.aimY - camY;
    context.beginPath();
    context.arc(ax, ay, w.radius, 0, 2 * Math.PI);
    context.fill();
    context.stroke();
    // The moment, as a disc growing to the edge.
    context.beginPath();
    context.arc(ax, ay, w.radius * w.progress, 0, 2 * Math.PI);
    context.fill();
    return;
  }
  if (w.shape === 'dash') {
    context.save();
    context.translate(x, y);
    context.rotate(angle);
    context.fillRect(0, -w.width / 2, w.length, w.width);
    // An elite's dash turns after him: its lane is only where it sets off, so dashed.
    if (!w.boss) context.setLineDash([10, 8]);
    context.strokeRect(0, -w.width / 2, w.length, w.width);
    context.setLineDash([]);
    // Chevrons along the lane, filling in as the moment nears.
    context.beginPath();
    const marks = 4;
    for (let i = 0; i < marks; i++) {
      if (i / marks > w.progress) break;
      const at = ((i + 0.5) / marks) * w.length;
      context.moveTo(at - 10, -w.width / 3);
      context.lineTo(at, 0);
      context.lineTo(at - 10, w.width / 3);
    }
    context.stroke();
    context.restore();
    return;
  }
  if (w.shape === 'burst') {
    // A spoke for each shot, the way it will fly, growing out as the moment nears.
    const reach = w.length * (0.35 + 0.65 * w.progress);
    context.lineWidth = Math.max(w.radius, 3);
    context.lineCap = 'round';
    context.strokeStyle = `rgba(${rgb}, ${0.25 + 0.45 * w.progress})`;
    context.beginPath();
    for (let i = 0; i < w.count; i++) {
      const turn = angle + (i * 2 * Math.PI) / w.count;
      context.moveTo(x + Math.cos(turn) * 18, y + Math.sin(turn) * 18);
      context.lineTo(x + Math.cos(turn) * reach, y + Math.sin(turn) * reach);
    }
    context.stroke();
    context.lineCap = 'butt';
    return;
  }
  // A bolt: a line to where he stood, and the shot gathering at the cat.
  context.setLineDash([6, 8]);
  context.beginPath();
  context.moveTo(x, y);
  context.lineTo(w.aimX - camX, w.aimY - camY);
  context.stroke();
  context.setLineDash([]);
  context.fillStyle = `rgba(${rgb}, ${0.4 + 0.5 * w.progress})`;
  context.beginPath();
  context.arc(x, y, w.radius * (0.4 + w.progress), 0, 2 * Math.PI);
  context.fill();
}

/** Draws a cat's shot at (x, y) on the screen. */
export function drawEnemyShot(
  context: CanvasRenderingContext2D,
  shot: EnemyShot,
  x: number,
  y: number,
  light: boolean
) {
  if (shot.kind === 'laser') {
    context.fillStyle = '#ef4444';
    context.beginPath();
    context.arc(x, y, 5, 0, 2 * Math.PI);
    context.fill();
    return;
  }
  const rgb = shot.kind === 'boss' ? BOSS : ELITE;
  if (!light) {
    context.fillStyle = `rgba(${rgb}, 0.25)`;
    context.beginPath();
    context.arc(x, y, shot.radius * 1.7, 0, 2 * Math.PI);
    context.fill();
  }
  context.fillStyle = `rgb(${rgb})`;
  context.beginPath();
  context.arc(x, y, shot.radius, 0, 2 * Math.PI);
  context.fill();
  context.fillStyle = '#fff7ed';
  context.beginPath();
  context.arc(x, y, shot.radius * 0.45, 0, 2 * Math.PI);
  context.fill();
}

/**
 * Marks a rare cat at (x, y) on the screen, `half` its drawn size: a thick ring in its
 * colour (an elite's pink, a visitor's gold), a soft halo in full graphics, and a
 * diamond bobbing over its head, drawn over the crowd.
 */
export function drawRareMarker(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  half: number,
  elite: boolean,
  time: number,
  light: boolean
) {
  const rgb = elite ? ELITE : VISITOR;
  if (!light) {
    context.fillStyle = `rgba(${rgb}, ${0.14 + 0.06 * Math.sin(time / 220)})`;
    context.beginPath();
    context.arc(x, y, half + 9, 0, 2 * Math.PI);
    context.fill();
  }
  context.strokeStyle = `rgb(${rgb})`;
  context.lineWidth = 3;
  context.beginPath();
  context.arc(x, y, half + 3, 0, 2 * Math.PI);
  context.stroke();
  const top = y - half - 14 + Math.sin(time / 200) * 2;
  context.fillStyle = `rgb(${rgb})`;
  context.beginPath();
  context.moveTo(x, top - 6);
  context.lineTo(x + 5, top);
  context.lineTo(x, top + 6);
  context.lineTo(x - 5, top);
  context.closePath();
  context.fill();
}
