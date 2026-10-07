// Usage, from the repo root:
//   node docs/ai/cat-artwork-2026-10-07/recolor.cjs <in.webp> <out.webp> <degrees>
// Turns the orange fur of a keyed image toward yellow by rotating hues near
// orange: fully between 12° and 38°, fading out to nothing at 0° and 55°, so pink
// noses and ears and green eyes keep their colour. Run it on key.cjs's output
// once: running it again shifts the colour again.
const sharp = require('sharp');

const [, , input, output, deg] = process.argv;
const SHIFT = Number(deg);

function weight(h) {
  if (h >= 12 && h <= 38) return 1;
  if (h > 0 && h < 12) return h / 12;
  if (h > 38 && h < 55) return (55 - h) / 17;
  return 0;
}

(async () => {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), c = max - min;
    if (c === 0) continue;
    let h = max === r ? ((g - b) / c) % 6 : max === g ? (b - r) / c + 2 : (r - g) / c + 4;
    h = (h * 60 + 360) % 360;
    const w = weight(h);
    if (!w) continue;
    // Rotate the hue, keeping the pixel's lightness and chroma (HSV with the same max and min).
    const h2 = ((h + SHIFT * w) % 360) / 60;
    const x = c * (1 - Math.abs((h2 % 2) - 1));
    const [r1, g1, b1] =
      h2 < 1 ? [c, x, 0] : h2 < 2 ? [x, c, 0] : h2 < 3 ? [0, c, x] : h2 < 4 ? [0, x, c] : h2 < 5 ? [x, 0, c] : [c, 0, x];
    data[i] = Math.round((r1 + min) * 255);
    data[i + 1] = Math.round((g1 + min) * 255);
    data[i + 2] = Math.round((b1 + min) * 255);
  }
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .webp({ quality: 82, alphaQuality: 90 })
    .toFile(output);
  console.log('wrote', output);
})();
