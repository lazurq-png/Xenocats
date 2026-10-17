// Picks the tests a change can affect, so a check runs what the change touches
// instead of every suite every time.
//
// Usage: node scripts/affected-tests.mjs [--base <ref>] [--run] [--json]
//        (npm run test:affected -- --base Nightrun --run)
//
// Compares the working tree (committed, staged, unstaged and untracked) with the
// merge base of HEAD and <ref>. Without --base, <ref> is whichever of `main`,
// `dev` and `Nightrun` is nearest to HEAD: on one of those branches that is HEAD
// itself, so the selection covers the uncommitted work and not every commit the
// branch has that `main` lacks. Then it prints:
//
//   unit  `vitest related` over the changed files: Vitest follows the imports
//         itself. The whole suite when Vitest's own configuration changed.
//   e2e   the browser specs that visit a route the change reaches. A changed
//         file is followed through the imports to the App Router files that
//         use it (page, layout, route, error, ...): only through the importers
//         that import a top-level name the change touched (its declarations'
//         code, comments and types aside, as at the merge base), and within each
//         importer only through the declarations that use one. A new file, a
//         changed side effect or directive, or an import of it the top level
//         does not show (`import()`) counts as all of it. Each route is reduced to its
//         area (`/cats`, `/cats/survival`, `/login`, `/dashboard/invoices`, ...),
//         and a spec covers every area whose path appears in it. What reaches
//         the dashboard only through its cats (cat-layer.tsx) selects only the
//         cat-attacks specs there: every other spec runs with the cats paused.
//   database  the opt-in database tests (`tests/unit/data.test.ts`), when a
//         query, the schema or the tests themselves changed: `npm test` and
//         `vitest related` skip them unless DATABASE_TESTS=1 is set, so the
//         selection names them. They write to the `xenocats_vitest` schema.
//
// It errs towards running more: a file it cannot place (configuration, auth,
// the root layout, seed data, the schema, a deleted page or config file,
// anything outside the known folders), or a change that reaches what the login
// or every request runs (auth.ts, proxy.ts), selects the whole e2e suite, and
// says why. CI still runs everything on every push.
//
// --run  runs the selection: unit tests, the database tests, then browser tests
//        (against `next dev`), stopping at the first failure; exits with that
//        failure's code.
// --json prints the selection as JSON instead.

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

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
  /^vercel\.json$/,
  /^\.prettierrc/,
  /^\.prettierignore$/,
  /^\.env\.example$/,
  /^scripts\/art\//, // artwork tools, run by hand
  /^scripts\/ci-database\.mjs$/, // only CI's database container runs it
];

// Every request, the login, the test database or every spec passes through these.
const E2E_FULL = new Map([
  ['proxy.ts', 'runs on every request'],
  ['auth.ts', 'the login every logged-in spec uses'],
  ['auth.config.ts', 'decides which pages need a session'],
  ['app/lib/placeholder-data.ts', 'the seed data the browser tests run on'],
  ['scripts/db.mjs', 'builds the schema the browser tests run on'],
  ['playwright.config.ts', 'configures every spec'],
  ['tests/e2e/fixtures.ts', 'every spec imports it'],
  ['tests/e2e/global-setup.ts', 'runs before every spec'],
  ['scripts/affected-tests.mjs', 'the selector cannot vouch for itself'],
]);

// The dashboard's cats come through this provider (app/dashboard/layout.tsx). Every
// spec outside the cat-attacks group runs with the cats paused (tests/e2e/fixtures.ts),
// so a file that reaches the dashboard only through it changes nothing they see.
const CAT_GATE = 'app/ui/xenocats/cat-layer.tsx';

const UNIT_FULL = /^(vitest\.config\.\w+|package\.json|package-lock\.json|tsconfig\.json)$/;

// What the opt-in database tests cover: the queries, the schema and how it is
// applied, and the tests themselves.
const DATABASE =
  /^(app\/lib\/data\.ts|tests\/unit\/data\.test\.ts|db\/migrations\/[^/]+\.sql|scripts\/db\.mjs)$/;
const DATABASE_TESTS = 'tests/unit/data';
// Set for a selection of specs: it drops the browser tests' dependency on the cat
// specs (playwright.config.ts), which a filter by file does not, and keeps the login
// setup the logged-in specs need (`--no-deps` would drop both).
const NO_CAT_DEPS = 'E2E_NO_CAT_DEPS';

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

// The area a route belongs to: its first two segments (a dashboard section, a game
// under /cats, or a top-level page). Pages deeper than that (create, [id]/edit) are
// reached by clicking through their area, so specs often never name them.
export function areaOf(route) {
  const segments = route.split('/').filter(Boolean);
  const end = segments.findIndex((s, i) => i >= 2 || s.startsWith('['));
  return '/' + segments.slice(0, end < 0 ? undefined : end).join('/');
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
      for (const [statement, spec] of content.matchAll(pattern)) {
        // A type changes nothing at run time; the type check covers it.
        if (/^(import|export)\s+type\s/.test(statement)) continue;
        const target = resolveImport(file, spec, files);
        if (!target) continue;
        if (!importers.has(target)) importers.set(target, new Set());
        importers.get(target).add(file);
      }
    }
  }
  return { files, importers, text };
}

const isRouteFile = (f) => f.startsWith('app/') && ROUTE_FILE.test(path.posix.basename(f));

// The file and every file that imports it, directly or not; never past `stop`,
// unless the file is `stop` itself.
function importersOf(file, importers, stop) {
  const seen = new Set([file]);
  const queue = [file];
  while (queue.length) {
    const current = queue.shift();
    if (current === stop && current !== file) continue;
    for (const parent of importers.get(current) ?? []) {
      if (!seen.has(parent)) {
        seen.add(parent);
        queue.push(parent);
      }
    }
  }
  return seen;
}

// A file's top level, as the trace below reads it: what each declaration declares,
// exports and says, what it imports from where, and the statements that are neither.
// Types are left out: they change nothing at run time. `null` when it does not parse.
export function topLevel(text, file) {
  const kind = file.endsWith('.tsx')
    ? ts.ScriptKind.TSX
    : file.endsWith('.ts')
      ? ts.ScriptKind.TS
      : ts.ScriptKind.JSX;
  const source = ts.createSourceFile(
    file,
    text.replaceAll('\r\n', '\n'),
    ts.ScriptTarget.Latest,
    false,
    kind
  );
  if (source.parseDiagnostics?.length) return null;
  // What a statement does, comments left out: what the diff compares.
  const printer = ts.createPrinter({ removeComments: true });
  const codeOf = (node) => () => printer.printNode(ts.EmitHint.Unspecified, node, source);
  /** @type {ts.Statement[]} */
  const others = [];
  const top = {
    /** @type {{ names: string[], exported: string[], text: string, code: () => string }[]} */
    declarations: [],
    /** @type {{ local: string, name: string, from: string }[]} name: 'default', '*' or the export's */
    imports: [],
    /** @type {{ from: string, name: string, as: string }[]} name '*' for all, as '*' for `export *` */
    reexports: [],
    /** @type {{ local: string, as: string }[]} `export { a as b }` */
    exportList: [],
    /** @type {string[]} modules imported for their side effects */
    bare: [],
    /** @type {string[]} 'use client', 'use server' */
    directives: [],
    /** @type {string[]} every other statement: run as the module loads */
    other: [],
    otherCode: () => others.map((node) => codeOf(node)()),
  };
  for (const statement of source.statements) {
    const text = statement.getText(source);
    const modifiers = (ts.canHaveModifiers(statement) && ts.getModifiers(statement)) || [];
    const has = (kind) => modifiers.some((m) => m.kind === kind);
    if (ts.isImportDeclaration(statement)) {
      const from = statement.moduleSpecifier.text;
      const clause = statement.importClause;
      if (!clause) top.bare.push(from);
      else if (!clause.isTypeOnly) {
        if (clause.name) top.imports.push({ local: clause.name.text, name: 'default', from });
        const bindings = clause.namedBindings;
        if (bindings && ts.isNamespaceImport(bindings))
          top.imports.push({ local: bindings.name.text, name: '*', from });
        else
          for (const e of bindings?.elements ?? [])
            if (!e.isTypeOnly)
              top.imports.push({ local: e.name.text, name: (e.propertyName ?? e.name).text, from });
      }
    } else if (ts.isExportDeclaration(statement)) {
      if (statement.isTypeOnly) continue;
      const from = statement.moduleSpecifier?.text;
      const clause = statement.exportClause;
      if (!clause || ts.isNamespaceExport(clause))
        top.reexports.push({ from, name: '*', as: clause ? clause.name.text : '*' });
      else
        for (const e of clause.elements) {
          if (e.isTypeOnly) continue;
          const name = (e.propertyName ?? e.name).text;
          if (from) top.reexports.push({ from, name, as: e.name.text });
          else top.exportList.push({ local: name, as: e.name.text });
        }
    } else if (ts.isExportAssignment(statement)) {
      // `export default <expression>`: no local name, so nothing else can refer to it.
      top.declarations.push({
        names: ['default'],
        exported: ['default'],
        text: statement.expression.getText(source),
        code: codeOf(statement),
      });
    } else if (
      ts.isInterfaceDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement) ||
      ts.isModuleDeclaration(statement) ||
      has(ts.SyntaxKind.DeclareKeyword)
    ) {
      continue;
    } else if (ts.isVariableStatement(statement)) {
      const names = statement.declarationList.declarations.flatMap((d) => bindingNames(d.name));
      top.declarations.push({
        names,
        exported: has(ts.SyntaxKind.ExportKeyword) ? names : [],
        text,
        code: codeOf(statement),
      });
    } else if (
      ts.isFunctionDeclaration(statement) ||
      ts.isClassDeclaration(statement) ||
      ts.isEnumDeclaration(statement)
    ) {
      const names = statement.name ? [statement.name.text] : [];
      const exported = !has(ts.SyntaxKind.ExportKeyword)
        ? []
        : has(ts.SyntaxKind.DefaultKeyword)
          ? ['default']
          : names;
      top.declarations.push({
        names: names.length ? names : ['default'],
        exported,
        text,
        code: codeOf(statement),
      });
    } else if (ts.isExpressionStatement(statement) && ts.isStringLiteral(statement.expression)) {
      top.directives.push(text);
    } else {
      top.other.push(text);
      others.push(statement);
    }
  }
  return top;
}

function bindingNames(name) {
  if (ts.isIdentifier(name)) return [name.text];
  return name.elements.flatMap((e) => (ts.isOmittedExpression(e) ? [] : bindingNames(e.name)));
}

// The top-level names whose run-time meaning differs between two versions of a file:
// a declaration's code (its comments aside), or where an import binding comes from.
// `null` (all of it) when anything else changed: a directive, a side effect, an
// export list.
export function changedNames(before, after) {
  if (!before || !after) return null;
  const same = (key) => JSON.stringify(before[key]) === JSON.stringify(after[key]);
  if (!['directives', 'bare', 'reexports', 'exportList'].every(same)) return null;
  if (JSON.stringify(before.otherCode()) !== JSON.stringify(after.otherCode())) return null;
  const texts = (top) => {
    const byName = new Map();
    for (const d of top.declarations)
      for (const n of d.names) byName.set(n, `${byName.get(n) ?? ''}\n${d.code()}`);
    for (const i of top.imports) byName.set(i.local, `import ${i.name} from ${i.from}`);
    return byName;
  };
  const [old, now] = [texts(before), texts(after)];
  return new Set(
    [...new Set([...old.keys(), ...now.keys()])].filter((n) => old.get(n) !== now.get(n))
  );
}

// A test for any of `names` used as an identifier. It errs towards a match: a
// property or a word in a string counts too.
function usesOf(names) {
  const ids = [...names].filter((n) => n !== 'default').map(escapeRegExp);
  return ids.length ? new RegExp(`(?<![\\w$])(?:${ids.join('|')})(?![\\w$])`) : null;
}

// Within one file, the declarations that change with `names`, transitively, and the
// names it exports that change with them. `null` when a statement run as the
// module loads uses one: then all of the file counts as changed.
function spread(top, names) {
  const locals = new Set(names);
  const changed = new Set();
  for (let grew = true; grew;) {
    grew = false;
    const uses = usesOf(locals);
    for (const d of top.declarations) {
      if (changed.has(d) || !(d.names.some((n) => locals.has(n)) || uses?.test(d.text))) continue;
      changed.add(d);
      d.names.forEach((n) => locals.add(n));
      grew = true;
    }
  }
  const uses = usesOf(locals);
  if (uses && top.other.some((t) => uses.test(t))) return null;
  const exports = new Set([...changed].flatMap((d) => d.exported));
  for (const e of top.exportList) if (locals.has(e.local)) exports.add(e.as);
  return { changed: changed.size > 0, exports };
}

// The files a change to `file` reaches: like importersOf, but following only the
// importers that import what changed, and within each only the declarations that use
// it. `names` are the file's changed top-level names, `null` for all of it. An
// importer counts as wholly changed when it imports the file for its side effects
// or in a way the top level does not show (`import()`), or does not parse.
function trace(file, names, graph, stop) {
  const { files, importers, text } = graph;
  const tops = new Map();
  const topOf = (f) => {
    if (!tops.has(f)) tops.set(f, /\.(tsx?|mjs|js)$/.test(f) ? topLevel(text.get(f), f) : null);
    return tops.get(f);
  };
  const ALL = null;
  const first = names && topOf(file) ? spread(topOf(file), names) : null;
  const exportsOf = new Map([[file, first ? first.exports : ALL]]);
  const state = new Map(); // importer → the names that changed under it
  const reached = new Set([file]);
  const queue = [file];
  while (queue.length) {
    const current = queue.shift();
    if (current === stop && current !== file) continue;
    const out = exportsOf.get(current);
    if (out && !out.size) continue;
    for (const importer of importers.get(current) ?? []) {
      if (reached.has(importer) && exportsOf.get(importer) === ALL) continue;
      const top = topOf(importer);
      if (!state.has(importer)) state.set(importer, { locals: new Set(), reexports: new Set() });
      const { locals, reexports } = state.get(importer);
      let all = !top;
      if (top) {
        const here = (spec) => resolveImport(importer, spec, files) === current;
        const changes = (name) => out === ALL || out.has(name);
        let found = false;
        for (const i of top.imports.filter((i) => here(i.from))) {
          found = true;
          if (i.name === '*' || changes(i.name)) locals.add(i.local);
        }
        if (top.bare.some(here)) found = all = true;
        for (const r of top.reexports.filter((r) => r.from && here(r.from))) {
          found = true;
          if (r.as === '*') {
            if (out === ALL) all = true;
            else out.forEach((n) => n !== 'default' && reexports.add(n));
          } else if (r.name === '*' || changes(r.name)) reexports.add(r.as);
        }
        if (!found) all = true;
      }
      const spreadHere = all ? null : spread(top, locals);
      const next = spreadHere ? new Set([...spreadHere.exports, ...reexports]) : ALL;
      if (next !== ALL && !spreadHere.changed && !next.size) continue; // imports, never uses
      const previous = exportsOf.get(importer);
      const grew = !reached.has(importer) || next === ALL || next.size > (previous?.size ?? -1);
      reached.add(importer);
      exportsOf.set(importer, next);
      if (grew) queue.push(importer);
    }
  }
  return reached;
}

// The specs in playwright.config.ts's cat-attacks group, the only ones that run
// with the cats unpaused.
function catAttackSpecs(root) {
  const config = readFileSync(path.join(root, 'playwright.config.ts'), 'utf8');
  const group = config.match(/'cat-attacks':\s*\[([^\]]*)\]/);
  if (!group) throw new Error('playwright.config.ts has no cat-attacks group');
  return new Set(
    [...group[1].matchAll(/'([^']+)'/g)].map(([, name]) => `tests/e2e/${name}.spec.ts`)
  );
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

// The selection for a list of changed paths (relative, `/`-separated). `before(file)`
// gives a file's text before the change (`null` when it is new); with it, a changed
// code file is followed only through what changed in it. Without it, all of it.
export function select(changed, root = ROOT, { before } = {}) {
  const { files, importers, text } = importersGraph(root);
  const routeFiles = [...files].filter(isRouteFile);
  const allAreas = [
    ...new Set(routeFiles.map((f) => areaOf(routeOf(path.posix.dirname(f).slice(3))))),
  ].sort();
  const specDir = path.join(root, 'tests/e2e');
  const specText = new Map(
    readdirSync(specDir)
      .filter((f) => f.endsWith('.spec.ts'))
      .map((f) => [`tests/e2e/${f}`, readFileSync(path.join(specDir, f), 'utf8')])
  );
  const specs = [...specText].map(([file, t]) => ({ file, areas: specAreas(t, allAreas) }));
  const catSpecs = catAttackSpecs(root);

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

    if (E2E_FULL.has(file)) {
      full(file, E2E_FULL.get(file));
    } else if (file.startsWith('db/migrations/')) {
      full(file, 'the schema every browser test runs on');
    } else if (file.startsWith('tests/unit/')) {
      reasons.push({ file, e2e: 'none (unit test)' });
    } else if (/^tests\/e2e\/[^/]+\.spec\.ts$/.test(file)) {
      if (exists) e2eSpecs.add(file);
      reasons.push({ file, e2e: exists ? 'itself' : 'none (deleted spec)' });
    } else if (/^tests\/e2e\/[^/]+\.ts$/.test(file)) {
      // A helper: the specs that import it. The login setup: the specs using its session.
      const name = file.endsWith('/auth.setup.ts') ? 'demo-user' : path.posix.basename(file, '.ts');
      const imports = new RegExp(`from '\\./${escapeRegExp(name)}'`);
      const picked = [...specText].filter(([, t]) => imports.test(t)).map(([f]) => f);
      picked.forEach((s) => e2eSpecs.add(s));
      reasons.push({ file, e2e: `the ${picked.length} spec(s) that import it` });
    } else if (file.startsWith('public/')) {
      const url = file.slice('public'.length);
      const users = [...text].filter(
        ([, t]) => t.includes(url) || t.includes(path.posix.dirname(url) + '/')
      );
      if (!users.length) reasons.push({ file, e2e: 'none (no source file names it)' });
      else
        placeByRoutes(
          file,
          users.map(([f]) => f)
        );
    } else if (file.startsWith('app/') && files.has(file)) {
      const names = namesChanged(file);
      if (names && !names.size) reasons.push({ file, e2e: 'none (no run-time change)' });
      else placeByRoutes(file, [file], names);
    } else if (file.startsWith('app/') && !exists && !isRouteFile(file)) {
      // What imported it changed with it (or the type check fails), and is placed itself.
      reasons.push({ file, e2e: 'none (deleted; its importers are placed)' });
    } else if (file.startsWith('app/') && !exists) {
      const affected = areasOfRouteFile(file, allAreas);
      if (affected === null) full(file, `the root ${path.posix.basename(file)} was deleted`);
      else if (specs.some((s) => s.areas.some((a) => affected.includes(a))))
        pick(file, new Set(affected), new Set());
      else reasons.push({ file, e2e: 'none (a deleted page no spec visits)' });
    } else {
      full(file, exists ? 'outside the app code the selector can trace' : 'deleted or renamed');
    }
  }

  // The top-level names a code file's change touches, from its text before the
  // change; `null` for all of it (a new file, no earlier text, or one that does not
  // parse).
  function namesChanged(file) {
    const old = before?.(file);
    if (old == null || !/\.(tsx?|mjs|js)$/.test(file)) return null;
    return changedNames(topLevel(old, file), topLevel(text.get(file), file));
  }

  // `names`: the start's changed top-level names, `null` for the whole file.
  function placeByRoutes(file, starts, names = null) {
    const areas = new Set();
    const catAreas = new Set();
    const graph = { files, importers, text };
    for (const start of starts) {
      const reached = trace(start, names, graph);
      const direct = trace(start, names, graph, CAT_GATE);
      const root = [...reached].find((f) => f !== start && E2E_FULL.has(f));
      if (root) return full(file, `reaches ${root}: ${E2E_FULL.get(root)}`);
      for (const routeFile of [...reached].filter(isRouteFile)) {
        const affected = areasOfRouteFile(routeFile, allAreas);
        if (affected === null)
          return full(file, `reaches the root ${path.posix.basename(routeFile)}`);
        affected.forEach((a) => (direct.has(routeFile) ? areas : catAreas).add(a));
      }
    }
    areas.forEach((a) => catAreas.delete(a));
    const what = names && `${[...names].sort().join(', ')} → `;
    if (!areas.size && !catAreas.size) {
      // What changed is used by nothing a page imports, though the file is.
      if (names && [...importersOf(file, importers)].some(isRouteFile))
        return reasons.push({ file, e2e: `none (${what}no route)` });
      return full(file, 'reaches no route');
    }
    pick(file, areas, catAreas, what ?? '');
  }

  // The specs visiting `areas`, and the cat-attacks specs visiting `catAreas`.
  function pick(file, areas, catAreas, what = '') {
    const picked = specs
      .filter(
        (s) =>
          s.areas.some((a) => areas.has(a)) ||
          (catSpecs.has(s.file) && s.areas.some((a) => catAreas.has(a)))
      )
      .map((s) => s.file);
    const where = [
      ...areas,
      ...(catAreas.size ? [`the cats on ${[...catAreas].join(', ')}`] : []),
    ].join(', ');
    if (!picked.length) return full(file, `no spec visits ${where}`);
    picked.forEach((s) => e2eSpecs.add(s));
    reasons.push({ file, e2e: `${what}${where} → ${picked.length} spec(s)` });
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

// Of the branches work is merged into, the one with the fewest commits between
// it and HEAD: HEAD's own branch when it is one of them.
function nearestBase() {
  const behind = (ref) => {
    try {
      const [mergeBase] = git('merge-base', ref, 'HEAD');
      return Number(git('rev-list', '--count', `${mergeBase}..HEAD`)[0]);
    } catch {
      return Infinity; // no such branch here
    }
  };
  const [nearest] = ['main', 'dev', 'Nightrun']
    .map((ref) => ({ ref, n: behind(ref) }))
    .sort((a, b) => a.n - b.n);
  if (nearest.n === Infinity) throw new Error('none of main, dev, Nightrun exists: pass --base');
  return nearest.ref;
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
      ? `${NO_CAT_DEPS}=1 npx playwright test ${selection.e2e.specs.join(' ')}`
      : null;
  const database = selection.database.length
    ? `DATABASE_TESTS=1 npx vitest run ${DATABASE_TESTS}`
    : null;
  return { unit, database, e2e };
}

function main(argv) {
  const baseAt = argv.indexOf('--base');
  const base = baseAt >= 0 ? argv[baseAt + 1] : nearestBase();
  const [mergeBase] = git('merge-base', base, 'HEAD');
  const changed = [
    ...new Set([
      ...git('diff', '--name-only', '--no-renames', mergeBase),
      ...git('ls-files', '--others', '--exclude-standard'),
    ]),
  ].sort();
  const before = (file) => {
    try {
      const options = { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] };
      return execFileSync('git', ['show', `${mergeBase}:${file}`], options);
    } catch {
      return null; // new since the merge base
    }
  };
  const selection = select(changed, ROOT, { before });
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
    cmds.e2e && {
      cmd: `npx playwright test${selection.e2e.full ? '' : ` ${selection.e2e.specs.join(' ')}`}`,
      env: selection.e2e.full ? undefined : { ...process.env, [NO_CAT_DEPS]: '1' },
      shown: cmds.e2e,
    },
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
