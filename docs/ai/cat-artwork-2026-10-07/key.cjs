// Usage, from the repo root:
//   node docs/ai/cat-artwork-2026-10-07/key.cjs <in.jpg> <out.webp> [--erode N] [--hole x,y]...
// Removes the near-white background connected to the image border (flood fill),
// feathers the edge, and writes a 512x512 transparent WebP like the existing art.
// --hole x,y also clears a near-white area enclosed by the cat (e.g. between tail
// and body), seeded at that point of the 512x512 output. --erode N shrinks the
// opaque area by N pixels, removing an outline or floor line baked into the edge.
const sharp = require('sharp');

const [, , input, output, ...opts] = process.argv;
const holes = [];
let erode = 0;
for (let k = 0; k < opts.length; k += 2) {
  if (opts[k] === '--erode') erode = Number(opts[k + 1]);
  else if (opts[k] === '--hole') holes.push(opts[k + 1].split(',').map(Number));
  else throw new Error(`unknown option ${opts[k]}`);
}
const SIZE = 512;
const HARD = 40; // distance from white below which a border-connected pixel is background
const SOFT = 90; // up to here, partially transparent at the boundary

(async () => {
  const { data, info } = await sharp(input)
    .resize(SIZE, SIZE, { fit: 'contain', background: '#ffffff' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const dist = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    dist[i] = Math.max(255 - r, 255 - g, 255 - b);
  }
  const bg = new Uint8Array(w * h);
  const stack = [];
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
  for (const [x, y] of holes) stack.push(y * w + x);
  while (stack.length) {
    const i = stack.pop();
    if (bg[i] || dist[i] >= HARD) continue;
    bg[i] = 1;
    const x = i % w, y = (i / w) | 0;
    if (x > 0) stack.push(i - 1);
    if (x < w - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - w);
    if (y < h - 1) stack.push(i + w);
  }
  for (let i = 0; i < w * h; i++) {
    if (bg[i]) { data[i * 4 + 3] = 0; continue; }
    const x = i % w, y = (i / w) | 0;
    const touchesBg =
      (x > 0 && bg[i - 1]) || (x < w - 1 && bg[i + 1]) || (y > 0 && bg[i - w]) || (y < h - 1 && bg[i + w]);
    if (touchesBg && dist[i] < SOFT) {
      data[i * 4 + 3] = Math.round(255 * (dist[i] - HARD) / (SOFT - HARD));
    }
  }
  for (let n = 0; n < erode; n++) {
    const a = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) a[i] = data[i * 4 + 3];
    for (let i = 0; i < w * h; i++) {
      const x = i % w, y = (i / w) | 0;
      let m = a[i];
      if (x > 0) m = Math.min(m, a[i - 1]);
      if (x < w - 1) m = Math.min(m, a[i + 1]);
      if (y > 0) m = Math.min(m, a[i - w]);
      if (y < h - 1) m = Math.min(m, a[i + w]);
      data[i * 4 + 3] = m;
    }
  }
  await sharp(data, { raw: { width: w, height: h, channels: 4 } }).webp({ quality: 82, alphaQuality: 90 }).toFile(output);
  console.log('wrote', output);
})();
