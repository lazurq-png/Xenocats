// Usage, from the repo root: node docs/ai/cat-artwork-2026-10-07/eyes.cjs
// Cuts Hypno Rex's two spiral eyes out of its awake artwork into an overlay of the
// same size (hypno-rex-eyes.webp), for its eyes-first entrance. The centres and
// radius were measured on hypno-rex-awake.webp (512x512); re-measure them if that
// image is regenerated.
const sharp = require('sharp');

const DIR = 'public/xenocats/cats/';
const EYES = [
  [199, 168],
  [293, 169],
];
const R = 24; // radius kept fully, in pixels
const FEATHER = 2; // fades to transparent over this many pixels beyond R

(async () => {
  const { data, info } = await sharp(DIR + 'hypno-rex-awake.webp')
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.min(...EYES.map(([cx, cy]) => Math.hypot(x - cx, y - cy)));
      const keep = d <= R ? 1 : d >= R + FEATHER ? 0 : (R + FEATHER - d) / FEATHER;
      const i = (y * w + x) * 4 + 3;
      data[i] = Math.round(data[i] * keep);
    }
  }
  await sharp(data, { raw: { width: w, height: h, channels: 4 } })
    .webp({ quality: 82, alphaQuality: 90 })
    .toFile(DIR + 'hypno-rex-eyes.webp');
  console.log('wrote', DIR + 'hypno-rex-eyes.webp');
})();
