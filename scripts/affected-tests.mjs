// Picks the tests a change can affect, so a check runs what the change touches
// instead of every suite every time.
//
// Usage: node scripts/affected-tests.mjs [--base <ref>] [--run] [--json]
//        (npm run test:affected -- --base night-2026-10-07 --run)
//
// Compares the working tree (committed, staged, unstaged and untracked) with the
// merge base of HEAD and <ref> (default `main`), then prints:
//
//   unit  `vitest related` over the changed files: Vitest follows the imports
//         itself. The whole suite when Vitest's own configuration changed.
//   e2e   the browser specs that visit a route the change reaches. A changed
//         file is followed through the imports to the App Router files that
//         use it (page, layout, route, error, ...), each route is reduced to its
//         area (`/cats`, `/login`, `/dashboard/invoices`, ...), and a spec
//         covers every area whose path appears in it.
//   database  the opt-in database tests (`tests/unit/data.test.ts`), when a
//         query, the schema or the tests themselves changed: `npm test` and
//         `vitest related` skip them unless DATABASE_TESTS=1 is set, so the
//         selection names them. They write to the `xenocats_vitest` schema.
//
// It errs towards running more: a file it cannot place (configuration, auth,
// the root layout, seed data, a deleted file, anything outside the known
// folders) selects the whole e2e suite, and says why. CI still runs everything
// on every push.
//
// --run  runs the selection: unit tests, the database tests, then browser tests
//        (against `next dev`), stopping at the first failure; exits with that
//        failure's code.
// --json prints the selection as JSON instead.

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Changes to these never need a test run (workflow changes have actionlint).
const NO_TESTS = [
  /^docs\//,
  /^\.claude\//,
  /^\.github\//,
  /^\.vscode\//,
  /\.md$/,
  /^\.gitignore$/,
  /^LICENSE/,
];

// Every request, the login, or the test database passes through these.
const E2E_FULL = new Map([
  ['proxy.ts', 'runs on every request'],
  ['auth.ts', 'the login every logged-in spec uses'],
  ['auth.config.ts', 'decides which pages need a session'],
  ['app/lib/placeholder-data.ts', 'the seed data the browser tests run on'],
]);

const UNIT_FULL = /^(vitest\.config\.\w+|package\.json|package-lock\.json|tsconfig\.json)$/;

// What the opt-in database tests cover: the queries, the schema and how it is
// applied, and the tests themselves.
const DATABASE =
  /^(app\/lib\/data\.ts|tests\/unit\/data\.test\.ts|db\/migrations\/[^/]+\.sql|scripts\/db\.mjs)$/;
const DATABASE_TESTS = 'tests/unit/data';

const CODE = /\.(tsx?|mjs|js|css)$/;
const ROUTE_FILE =
  /^(page|layout|template|route|loading|error|not-found|default|global-error)\.(tsx?|jsx?)$/;
const SUBTREE_FILE = /^(layout|template|loading|error|not-found|global-error)\./;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const posix = (p) => p.split(path.sep).join('/');

// Route path of an App Router directory: route groups `(x)` drop out.
function routeOf(appDir) {
  const segments = appDir.split('/').filter((s) => s && !/^\(.*\)$/.test(s));
  return '/' + segments.join('/');
}

// The area a route belongs to: a dashboard section, or a top-level page.
export function areaOf(route) {
  const [first, second] = route.split('/').filter(Boolean);
  if (!first) return '/';
  if (first === 'dashboard') return second ? `/dashboard/${second}` : '/dashboard';
  return `/${first}`;
}

function resolveImport(from, spec, files) {
  let base;
  if (spec.startsWith('@/')) base = spec.slice(2);
  else if (spec.startsWith('.')) base = path.posix.join(path.posix.dirname(from), spec);
  else return null; // a package
  for (const ext of ['', '.ts', '.tsx', '.js', '.mjs', '.css', '/index.ts', '/index.tsx']) {
    if (files.has(base + ext)) return base + ext;
  }
  return null;
}

const IMPORT_PATTERNS = [
  /(?:import|export)\s[^'"`;]*?\sfrom\s*['"]([^'"]+)['"]/g,
  /import\s*['"]([^'"]+)['"]/g,
  /import\(\s*['"]([^'"]+)['"]\s*\)/g,
];

// Who imports whom, over the app's own source and the root files it imports.
function importersGraph(root) {
  const sources = walk(path.join(root, 'app'))
    .map((f) => posix(path.relative(root, f)))
    .filter((f) => CODE.test(f));
  for (const f of readdirSync(root)) if (/\.(tsx?|mjs)$/.test(f)) sources.push(f);
  const files = new Set(sources);
  const importers = new Map();
  const text = new Map();
  for (const file of sources) {
    const content = readFileSync(path.join(root, file), 'utf8');
    text.set(file, content);
    if (file.endsWith('.css')) continue;
    for (const pattern of IMPORT_PATTERNS) {
      for (const [, spec] of content.matchAll(pattern)) {
        const target = resolveImport(file, spec, files);
        if (!target) continue;
        if (!importers.has(target)) importers.set(target, new Set());
        importers.get(target).add(file);
      }
    }
  }
  return { files, importers, text };
}

// The App Router files a file reaches, following importers upwards.
function routeFilesReaching(file, importers) {
  const seen = new Set([file]);
  const queue = [file];
  const found = [];
  while (queue.length) {
    const current = queue.shift();
    if (current.startsWith('app/') && ROUTE_FILE.test(path.posix.basename(current)))
      found.push(current);
    for (const parent of importers.get(current) ?? []) {
      if (!seen.has(parent)) {
        seen.add(parent);
        queue.push(parent);
      }
    }
  }
  return found;
}

// Areas a route file affects: a page or route handler its own; a layout, error
// or loading file every area beneath it. `null` means every area.
function areasOfRouteFile(routeFile, allAreas) {
  const route = routeOf(path.posix.dirname(routeFile).slice('app'.length));
  if (!SUBTREE_FILE.test(path.posix.basename(routeFile))) return [areaOf(route)];
  if (route === '/') return null;
  return allAreas.filter((a) => a === areaOf(route) || a.startsWith(route + '/'));
}

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// The areas a spec visits: each area's path, as a string or a URL regex, anywhere in
// it. A longer path counts for the area it belongs to (/cats/survival for /cats), but
// not for another area's (/dashboard/invoices is not /dashboard).
export function specAreas(specText, allAreas) {
  const text = specText.replaceAll('\\/', '/');
  return allAreas.filter((area) => {
    if (area === '/') return /['"`]\/['"`?#]/.test(text);
    const path = new RegExp(`(^|[^\\w-])(${escapeRegExp(area)}(?:/[\\w-]+)*)(?![\\w-])`, 'g');
    for (const match of text.matchAll(path)) if (areaOf(match[2]) === area) return true;
    return false;
  });
}

// The selection for a list of changed paths (relative, `/`-separated).
export function select(changed, root = ROOT) {
  const { files, importers, text } = importersGraph(root);
  const routeFiles = [...files].filter(
    (f) => f.startsWith('app/') && ROUTE_FILE.test(path.posix.basename(f))
  );
  const allAreas = [
    ...new Set(routeFiles.map((f) => areaOf(routeOf(path.posix.dirname(f).slice(3))))),
  ].sort();
  const specDir = path.join(root, 'tests/e2e');
  const specs = readdirSync(specDir)
    .filter((f) => f.endsWith('.spec.ts'))
    .map((f) => ({
      file: `tests/e2e/${f}`,
      areas: specAreas(readFileSync(path.join(specDir, f), 'utf8'), allAreas),
    }));

  const reasons = [];
  let unitFull = null;
  let e2eFull = null;
  const unitFiles = new Set();
  const e2eSpecs = new Set();
  const full = (file, why) => {
    e2eFull ??= `${file}: ${why}`;
    reasons.push({ file, e2e: `full (${why})` });
  };

  for (const file of changed) {
    if (NO_TESTS.some((p) => p.test(file))) {
      reasons.push({ file, e2e: 'none (no code)' });
      continue;
    }
    const exists = existsSync(path.join(root, file));
    if (UNIT_FULL.test(file)) unitFull ??= `${file} changed`;
    else if (exists && /\.(tsx?|mjs|js)$/.test(file)) unitFiles.add(file);

    if (!exists) {
      full(file, 'deleted or renamed; its users cannot be traced');
    } else if (file.startsWith('tests/unit/')) {
      reasons.push({ file, e2e: 'none (unit test)' });
    } else if (/^tests\/e2e\/[^/]+\.spec\.ts$/.test(file)) {
      e2eSpecs.add(file);
      reasons.push({ file, e2e: 'itself' });
    } else if (E2E_FULL.has(file)) {
      full(file, E2E_FULL.get(file));
    } else if (file.startsWith('public/')) {
      const url = file.slice('public'.length);
      const users = [...text].filter(
        ([, t]) => t.includes(url) || t.includes(path.posix.dirname(url) + '/')
      );
      if (!users.length) full(file, 'no source file names it');
      else
        placeByRoutes(
          file,
          users.map(([f]) => f)
        );
    } else if (file.startsWith('app/') && files.has(file)) {
      placeByRoutes(file, [file]);
    } else {
      full(file, 'outside the app code the selector can trace');
    }
  }

  function placeByRoutes(file, starts) {
    const areas = new Set();
    for (const start of starts) {
      for (const routeFile of routeFilesReaching(start, importers)) {
        const affected = areasOfRouteFile(routeFile, allAreas);
        if (affected === null)
          return full(file, `reaches the root ${path.posix.basename(routeFile)}`);
        affected.forEach((a) => areas.add(a));
      }
    }
    if (!areas.size) return full(file, 'reaches no route');
    const picked = specs.filter((s) => s.areas.some((a) => areas.has(a))).map((s) => s.file);
    if (!picked.length) return full(file, `no spec visits ${[...areas].join(', ')}`);
    picked.forEach((s) => e2eSpecs.add(s));
    reasons.push({ file, e2e: `${[...areas].join(', ')} → ${picked.length} spec(s)` });
  }

  return {
    unit: unitFull ? { full: unitFull } : { files: [...unitFiles].sort() },
    e2e: e2eFull ? { full: e2eFull } : { specs: [...e2eSpecs].sort() },
    database: changed.filter((file) => DATABASE.test(file)),
    reasons,
    specs,
  };
}

function git(...args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
}

export function commands(selection) {
  const unit = selection.unit.full
    ? 'npx vitest run'
    : selection.unit.files.length
      ? `npx vitest related --run ${selection.unit.files.join(' ')}`
      : null;
  const e2e = selection.e2e.full
    ? 'npx playwright test'
    : selection.e2e.specs.length
      ? `npx playwright test ${selection.e2e.specs.join(' ')}`
      : null;
  const database = selection.database.length
    ? `DATABASE_TESTS=1 npx vitest run ${DATABASE_TESTS}`
    : null;
  return { unit, database, e2e };
}

function main(argv) {
  const baseAt = argv.indexOf('--base');
  const base = baseAt >= 0 ? argv[baseAt + 1] : 'main';
  const [mergeBase] = git('merge-base', base, 'HEAD');
  const changed = [
    ...new Set([
      ...git('diff', '--name-only', '--no-renames', mergeBase),
      ...git('ls-files', '--others', '--exclude-standard'),
    ]),
  ].sort();
  const selection = select(changed);
  const cmds = commands(selection);

  if (argv.includes('--json')) {
    const { specs, ...rest } = selection;
    console.log(JSON.stringify({ base, mergeBase, changed, ...rest, commands: cmds }, null, 2));
  } else {
    console.log(`${changed.length} file(s) changed since ${base} (${mergeBase.slice(0, 7)})\n`);
    for (const r of selection.reasons) console.log(`  ${r.file}\n      e2e: ${r.e2e}`);
    console.log(
      `\nunit: ${selection.unit.full ? `FULL — ${selection.unit.full}` : `${selection.unit.files.length} changed file(s)`}`
    );
    console.log(`      ${cmds.unit ?? '(nothing to run)'}`);
    if (cmds.database) {
      console.log(
        `database: ${selection.database.join(', ')} changed; \`npm test\` and the unit line above skip its tests`
      );
      console.log(`      ${cmds.database}`);
    }
    console.log(
      `e2e:  ${selection.e2e.full ? `FULL — ${selection.e2e.full}` : `${selection.e2e.specs.length} spec(s)`}`
    );
    console.log(`      ${cmds.e2e ?? '(nothing to run)'}`);
  }

  if (!argv.includes('--run')) return 0;
  const runs = [
    cmds.unit && { cmd: cmds.unit },
    // Set through the environment, not the command line: Windows' shell has no `VAR=1 cmd`.
    cmds.database && {
      cmd: `npx vitest run ${DATABASE_TESTS}`,
      env: { ...process.env, DATABASE_TESTS: '1' },
      shown: cmds.database,
    },
    cmds.e2e && { cmd: cmds.e2e },
  ].filter(Boolean);
  for (const { cmd, env, shown } of runs) {
    console.log(`\n$ ${shown ?? cmd}`);
    const { status } = spawnSync(cmd, { cwd: ROOT, stdio: 'inherit', shell: true, env });
    if (status !== 0) return status ?? 1;
  }
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
