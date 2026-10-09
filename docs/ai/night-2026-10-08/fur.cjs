// Usage, from the repo root:
//   node docs/ai/night-2026-10-08/fur.cjs measure <image.webp>...
//   node docs/ai/night-2026-10-08/fur.cjs adjust <in.webp> <out.webp> <hueFrom> <hueTo> <lightness> [saturation] [hueShift]
//
// measure: over a cat's opaque pixels, the fur's average hue, saturation and
// lightness (HSL). "Fur" is the colourful, mid-light pixels: outlines (very dark),
// highlights and whites (very light or grey) are left out, and so are the eyes,
// which are a small share.
//
// adjust: scales the lightness (and, optionally, the saturation, and turns the hue
// by hueShift degrees) of the fur pixels
// whose hue lies between hueFrom and hueTo (degrees, wrapping), fading out over
// 10° outside that band; every other pixel, and the alpha, stays as it is. The
// output keeps the input's size, as webp like the other cat images.
const sharp = require('sharp');

function hsl(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const c = max - min;
  if (c === 0) return [0, 0, l];
  const s = c / (1 - Math.abs(2 * l - 1));
  let h = max === r ? ((g - b) / c) % 6 : max === g ? (b - r) / c + 2 : (r - g) / c + 4;
  h = (h * 60 + 360) % 360;
  return [h, s, l];
}

function rgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return [r + m, g + m, b + m];
}

const isFur = (s, l) => s > 0.12 && l > 0.12 && l < 0.88;

async function pixels(file) {
  return sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}

async function measure(file) {
  const { data, info } = await pixels(file);
  let n = 0;
  let sx = 0;
  let sy = 0;
  let ss = 0;
  let sl = 0;
  let opaque = 0;
  let all = 0;
  let dark = 0;
  let light = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 200) continue;
    opaque++;
    const [h, s, l] = hsl(data[i] / 255, data[i + 1] / 255, data[i + 2] / 255);
    all += l;
    if (l < 0.2) dark++;
    if (l > 0.7) light++;
    if (!isFur(s, l)) continue;
    n++;
    sx += Math.cos((h * Math.PI) / 180);
    sy += Math.sin((h * Math.PI) / 180);
    ss += s;
    sl += l;
  }
  const hue = ((Math.atan2(sy, sx) * 180) / Math.PI + 360) % 360;
  console.log(
    `${file}  ${info.width}x${info.height}  fur ${((100 * n) / opaque).toFixed(0)}% of opaque` +
      `  hue ${hue.toFixed(0)}  sat ${ss / n > 0 ? (ss / n).toFixed(2) : 0}  light ${(sl / n).toFixed(3)}` +
      `  | all opaque: light ${(all / opaque).toFixed(3)}, dark ${((100 * dark) / opaque).toFixed(0)}%, light ${((100 * light) / opaque).toFixed(0)}%`
  );
}

function inBand(h, from, to) {
  // Distance in degrees outside [from, to] (wrapping), 0 inside.
  const span = (to - from + 360) % 360;
  const d = (h - from + 360) % 360;
  if (d <= span) return 0;
  return Math.min(d - span, 360 - d);
}

async function adjust(input, output, from, to, light, sat = 1, shift = 0) {
  const { data, info } = await pixels(input);
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const [h, s, l] = hsl(data[i] / 255, data[i + 1] / 255, data[i + 2] / 255);
    if (!isFur(s, l)) continue;
    const outside = inBand(h, from, to);
    if (outside >= 10) continue;
    const w = 1 - outside / 10;
    const l2 = Math.min(Math.max(l * (1 + (light - 1) * w), 0), 1);
    const s2 = Math.min(Math.max(s * (1 + (sat - 1) * w), 0), 1);
    const h2 = (h + shift * w + 360) % 360;
    const [r, g, b] = rgb(h2, s2, l2);
    data[i] = Math.round(r * 255);
    data[i + 1] = Math.round(g * 255);
    data[i + 2] = Math.round(b * 255);
  }
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .webp({ quality: 82, alphaQuality: 90 })
    .toFile(output);
  console.log('wrote', output);
}

(async () => {
  const [, , command, ...rest] = process.argv;
  if (command === 'measure') for (const file of rest) await measure(file);
  else if (command === 'adjust') {
    const [input, output, ...numbers] = rest;
    const [from, to, light, sat = 1, shift = 0] = numbers.map(Number);
    // A missing or mistyped number would turn the fur black (NaN): refuse instead.
    if (
      !input ||
      !output ||
      numbers.length < 3 ||
      ![from, to, light, sat, shift].every(Number.isFinite)
    ) {
      console.error(
        'adjust <in> <out> <hueFrom> <hueTo> <lightness> [saturation] [hueShift]: numbers'
      );
      process.exit(1);
    }
    await adjust(input, output, from, to, light, sat, shift);
  } else {
    console.error(
      'measure <files> | adjust <in> <out> <hueFrom> <hueTo> <lightness> [saturation] [hueShift]'
    );
  }
})();
