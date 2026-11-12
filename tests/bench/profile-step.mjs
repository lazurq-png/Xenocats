// Where a crowded Survival step goes, by function and by line, run by hand:
//
//   node tests/bench/profile-step.mjs [cats]        (default 2000)
//
// A CPU profile taken inside Vitest cannot be read by line (its transform moves the
// lines, and the profile carries no source map). This bundles the arena with rolldown
// (Vitest's own bundler) into plain JavaScript in test-results/ (ignored by git), runs
// the step benchmark's crowd under Node's profiler, and prints each function's share of
// the time and the hottest lines with their source. A function the engine inlines into
// another counts as that one's (the step's own share is mostly what it calls).

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Session } from 'node:inspector/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { rolldown } from 'rolldown';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = path.join(root, 'test-results', 'profile-step');
const size = Number(process.argv[2] ?? 2000);
mkdirSync(out, { recursive: true });

const from = (file) =>
  JSON.stringify(path.join(root, 'app/ui/xenocats', file).replaceAll('\\', '/'));
const entry = path.join(out, 'entry.ts');
writeFileSync(
  entry,
  [
    `export { ARENA_CONFIG, createArena } from ${from('arena')};`,
    `export { MAX_WEAPON_LEVEL } from ${from('arsenal')};`,
    `export { CAT_TYPES } from ${from('cat-types')};`,
    `export { createRandom } from ${from('random')};`,
    `export { CROWD_ARSENAL } from ${from('test-hooks')};`,
  ].join('\n')
);
const bundleFile = path.join(out, 'bundle.mjs');
const bundle = await rolldown({ input: entry });
await bundle.write({ file: bundleFile, format: 'esm' });
await bundle.close();

// The step benchmark's crowd (tests/bench/arena-step.test.ts): warmed up, then profiled.
const m = await import(pathToFileURL(bundleFile).href);
const arena = m.createArena({
  random: m.createRandom(7),
  types: m.CAT_TYPES,
  viewport: { width: 1280, height: 800 },
  config: {
    escalation: [[0, size]],
    startingWeapons: m.CROWD_ARSENAL,
    startingLevel: m.MAX_WEAPON_LEVEL,
    hero: { ...m.ARENA_CONFIG.hero, resolve: 1e9 },
    arrivalShare: 40,
    gems: { ...m.ARENA_CONFIG.gems, value: 0, eliteValue: 0 },
    chestReach: -1,
  },
});
const walk = (i) => ({ x: Math.cos(i / 90), y: Math.sin(i / 90) });
for (let i = 0; i < 900; i++) arena.step(walk(i));
const session = new Session();
session.connect();
await session.post('Profiler.enable');
await session.post('Profiler.setSamplingInterval', { interval: 100 });
await session.post('Profiler.start');
const steps = 3000;
const t0 = performance.now();
for (let i = 900; i < 900 + steps; i++) arena.step(walk(i));
const msPerStep = (performance.now() - t0) / steps;
const { profile } = await session.post('Profiler.stop');
session.disconnect();
writeFileSync(path.join(out, 'step.cpuprofile'), JSON.stringify(profile));

const source = readFileSync(bundleFile, 'utf8').split('\n');
let total = 0;
const byFunction = new Map();
const byLine = new Map();
for (const node of profile.nodes) {
  total += node.hitCount;
  const name = node.callFrame.functionName || '(anonymous)';
  byFunction.set(name, (byFunction.get(name) ?? 0) + node.hitCount);
  for (const tick of node.positionTicks ?? []) {
    const key = `${name}|${tick.line}`;
    byLine.set(key, (byLine.get(key) ?? 0) + tick.ticks);
  }
}
const share = (n) => `${((100 * n) / total).toFixed(1).padStart(5)}%`;
console.log(`${arena.cats().length} cats, ${msPerStep.toFixed(3)} ms a step (profiled)\n`);
console.log('By function:');
for (const [name, n] of [...byFunction].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
  console.log(`${share(n)} ${name}`);
}
console.log('\nBy line (in the bundle, test-results/profile-step/bundle.mjs):');
for (const [key, n] of [...byLine].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
  const [name, line] = key.split('|');
  console.log(`${share(n)} ${name} L${line}: ${source[Number(line) - 1].trim().slice(0, 90)}`);
}
