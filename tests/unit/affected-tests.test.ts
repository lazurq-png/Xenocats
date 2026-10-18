import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  areaOf,
  changedNames,
  commands,
  select,
  specAreas,
  topLevel,
} from '@/scripts/affected-tests.mjs';

// Runs against the repository itself, so the selector is checked on the routes
// and specs that exist, and a new spec no area reaches fails here.

describe('affected-tests', () => {
  it('reduces a route to its area', () => {
    expect(areaOf('/')).toBe('/');
    expect(areaOf('/dashboard')).toBe('/dashboard');
    expect(areaOf('/dashboard/invoices/[id]/edit')).toBe('/dashboard/invoices');
    expect(areaOf('/cats')).toBe('/cats');
    // Each game under /cats is an area of its own.
    expect(areaOf('/cats/survival')).toBe('/cats/survival');
    expect(areaOf('/dashboard/invoices/create')).toBe('/dashboard/invoices');
  });

  it('reads the areas a spec visits, from strings and URL regexes', () => {
    const areas = ['/', '/cats', '/cats/survival', '/dashboard', '/dashboard/invoices', '/login'];
    expect(specAreas(`await page.goto('/dashboard/invoices?page=2');`, areas)).toEqual([
      '/dashboard/invoices',
    ]);
    expect(specAreas(`await expect(page).toHaveURL(/\\/dashboard$/);`, areas)).toEqual([
      '/dashboard',
    ]);
    expect(specAreas(`page.goto('/')`, areas)).toEqual(['/']);
    // A game is not /cats; a page deeper in an area counts for the area.
    expect(specAreas(`await page.goto('/cats/survival' + query);`, areas)).toEqual([
      '/cats/survival',
    ]);
    expect(specAreas(`page.goto('/dashboard/invoices/create')`, areas)).toEqual([
      '/dashboard/invoices',
    ]);
    // An asset path is not a route.
    expect(specAreas(`'/xenocats/cats/tabby.png'`, areas)).toEqual([]);
  });

  it('gives every spec an area, so a targeted run can reach each one', () => {
    for (const spec of select([]).specs) expect(spec.areas, spec.file).not.toEqual([]);
  });

  it('runs the specs of the area a component reaches, and not the others', () => {
    const { e2e } = select(['app/ui/invoices/table.tsx']);
    expect(e2e.specs).toContain('tests/e2e/invoices.spec.ts');
    expect(e2e.specs).not.toContain('tests/e2e/survival.spec.ts');
  });

  it('runs only the Survival specs for a change to the Survival game', () => {
    const { e2e } = select(['app/ui/xenocats/arena.ts']);
    expect(e2e.specs).toContain('tests/e2e/survival.spec.ts');
    expect(e2e.specs).not.toContain('tests/e2e/pet-cat.spec.ts');
    expect(e2e.specs).not.toContain('tests/e2e/invoices.spec.ts');
  });

  it('runs only the cat-attacks specs on the dashboard for what its cats do', () => {
    // sounds.ts reaches the dashboard through cat-layer.tsx alone; other specs pause the cats.
    const { e2e } = select(['app/ui/xenocats/sounds.ts']);
    expect(e2e.specs).toContain('tests/e2e/intensity.spec.ts'); // cat-attacks, /dashboard/settings
    expect(e2e.specs).not.toContain('tests/e2e/invoices.spec.ts');
    expect(e2e.specs).not.toContain('tests/e2e/customers.spec.ts');
    // cat-layer.tsx itself runs on every dashboard page, paused or not.
    expect(select(['app/ui/xenocats/cat-layer.tsx']).e2e.specs).toContain(
      'tests/e2e/invoices.spec.ts'
    );
  });

  it('runs the specs that import a changed browser-test helper', () => {
    const { e2e } = select(['tests/e2e/demo-user.ts']);
    expect(e2e.specs).toContain('tests/e2e/invoices.spec.ts');
    expect(e2e.specs).not.toContain('tests/e2e/login-limit.spec.ts');
  });

  it.each([
    'tests/unit/no-such.test.ts',
    'tests/e2e/no-such.spec.ts',
    'app/ui/no-such-file.tsx',
    'app/no-such-page/page.tsx', // a deleted page no spec visits
    'scripts/art/eyes.cjs',
    'vercel.json',
  ])('runs no browser test for %s', (file) => {
    expect(select([file]).e2e).toEqual({ specs: [] });
  });

  it('runs a changed spec itself, and no browser test for a unit test or a document', () => {
    expect(select(['tests/e2e/survival.spec.ts']).e2e).toEqual({
      specs: ['tests/e2e/survival.spec.ts'],
    });
    expect(select(['tests/unit/csv.test.ts', 'docs/ai/README.md']).e2e).toEqual({ specs: [] });
  });

  it.each([
    'app/ui/global.css', // the root layout
    'auth.ts',
    'proxy.ts',
    'app/lib/placeholder-data.ts',
    'postcss.config.js',
    'next.config.ts',
    'tests/e2e/global-setup.ts',
    'db/migrations/0005_example.sql',
    'scripts/affected-tests.mjs',
  ])('runs the whole browser suite for %s', (file) => {
    expect(select([file]).e2e.full).toBeTruthy();
  });

  describe('following only what changed in a file', () => {
    const now = (file: string) => readFileSync(path.join(process.cwd(), file), 'utf8');
    // A selection for `file`, as if its text before the change were `edit(text now)`.
    const selectEdited = (file: string, edit: (text: string) => string) => {
      const old = edit(now(file));
      expect(old, 'the edit changed nothing').not.toBe(now(file));
      return select([file], undefined, { before: (f: string) => (f === file ? old : now(f)) });
    };

    it('runs the Survival specs, not every spec, for a change to the leaderboard name', () => {
      const { e2e, reasons } = selectEdited('app/lib/schemas.ts', (t) =>
        t.replace('export const LeaderboardName = z', 'export const LeaderboardName = 0 || z')
      );
      expect(reasons[0].e2e).toMatch(/^LeaderboardName →/);
      expect(e2e.specs).toContain('tests/e2e/survival.spec.ts');
      expect(e2e.specs).toContain('tests/e2e/leaderboard.spec.ts');
      expect(e2e.specs).not.toContain('tests/e2e/invoices.spec.ts');
      expect(e2e.specs).not.toContain('tests/e2e/login-limit.spec.ts');
    });

    it('follows a change through the declarations in the file that use it', () => {
      // isPlainText is imported by no page, but the customer form's schema uses it.
      const { e2e } = selectEdited('app/lib/schemas.ts', (t) =>
        t.replace('=> !HIDDEN_CHARACTERS.test(text)', '=> !!text')
      );
      expect(e2e.specs).toContain('tests/e2e/customers.spec.ts');
      expect(e2e.specs).not.toContain('tests/e2e/survival.spec.ts');
      expect(e2e.specs).not.toContain('tests/e2e/invoices-filter.spec.ts');
    });

    it('follows a change through a re-export', () => {
      // buttons.tsx re-exports DeleteInvoice, which the invoices table renders.
      const { e2e } = selectEdited('app/ui/invoices/delete-invoice.tsx', (t) =>
        t.replace('fromDetailPage = false,', 'fromDetailPage = true,')
      );
      expect(e2e.specs).toContain('tests/e2e/invoices.spec.ts');
      expect(e2e.specs).not.toContain('tests/e2e/survival.spec.ts');
    });

    it('runs every spec of a module the change reaches through all its exports', () => {
      // Every action uses the connection, so every area with a form is in.
      const { e2e } = selectEdited('app/lib/actions.ts', (t) =>
        t.replace("import { sql } from '@/app/lib/db';", "import { sql } from './db';")
      );
      for (const spec of ['invoices', 'customers', 'survival', 'change-password', 'signup'])
        expect(e2e.specs).toContain(`tests/e2e/${spec}.spec.ts`);
    });

    it('runs no browser test for a change to types or to an export no page imports', () => {
      expect(
        selectEdited('app/lib/actions.ts', (t) =>
          t.replace("SurvivalRunResult = 'saved'", "SurvivalRunResult = 'kept' | 'saved'")
        ).e2e
      ).toEqual({ specs: [] });
      expect(selectEdited('app/lib/utils.ts', (t) => `${t}\nexport const gone = 1;\n`).e2e).toEqual(
        { specs: [] }
      );
    });

    it('takes all of a file whose module-level statements changed', () => {
      // A statement run as the module loads: every page that imports utils.ts.
      const { e2e } = selectEdited('app/lib/utils.ts', (t) => `${t}\nconsole.log('loaded');\n`);
      expect(e2e.specs).toContain('tests/e2e/invoices.spec.ts');
      expect(e2e.specs).toContain('tests/e2e/dashboard.spec.ts');
    });

    it('takes all of a new file, and all specs for what the login imports', () => {
      // schemas.ts, all of it, reaches auth.ts through credentials.ts.
      const fresh = select(['app/lib/schemas.ts'], undefined, { before: () => null });
      expect(fresh.e2e.full).toMatch(/reaches auth\.ts/);
      const { e2e } = selectEdited('app/lib/schemas.ts', (t) =>
        t.replace('USERNAME_PATTERN = /^', 'USERNAME_PATTERN = /^ ?')
      );
      expect(e2e.full).toMatch(/reaches auth\.ts/);
    });

    it('reads what a file declares, imports and exports', () => {
      const top = topLevel(
        [
          "'use client';",
          "import a, { b as c, type T } from './x';",
          "import * as ns from './y';",
          "import type { U } from './z';",
          'export const { d, e: [f] } = g();',
          'export default function () {}',
          'type V = 1;',
          'export { c as h };',
          "export * from './w';",
          'run();',
        ].join('\n'),
        'file.ts'
      )!;
      expect(top.imports.map((i) => `${i.local}=${i.name}`)).toEqual(['a=default', 'c=b', 'ns=*']);
      expect(top.declarations.map((d) => [d.names, d.exported])).toEqual([
        [
          ['d', 'f'],
          ['d', 'f'],
        ],
        [['default'], ['default']],
      ]);
      expect(top.exportList).toEqual([{ local: 'c', as: 'h' }]);
      expect(top.reexports).toEqual([{ from: './w', name: '*', as: '*' }]);
      expect(top.directives).toEqual(["'use client';"]);
      expect(top.other).toEqual(['run();']);
    });

    it('names the declarations and imports that changed, or all for anything else', () => {
      const names = (a: string, b: string) =>
        changedNames(topLevel(a, 'f.ts'), topLevel(b, 'f.ts'));
      expect(names('const a = 1;\nconst b = 2;', 'const a = 1;\nconst b = 3;')).toEqual(
        new Set(['b'])
      );
      expect(names("import { a } from './x';", "import { a } from './y';")).toEqual(new Set(['a']));
      expect(names('type A = 1;\nconst b = 2;', '// note\ntype A = 2;\nconst b = 2;')).toEqual(
        new Set()
      );
      // A comment changes nothing, inside a declaration too.
      expect(
        names('function a() {\n  return 1;\n}', 'function a() {\n  // why\n  return 1;\n}')
      ).toEqual(new Set());
      expect(names('const a = 1;', "'use client';\nconst a = 1;")).toBeNull();
      expect(names('const a = 1;', 'const a = 1;\na;')).toBeNull();
    });
  });

  it('runs the whole unit suite when its configuration changes', () => {
    expect(select(['vitest.config.mts']).unit.full).toBeTruthy();
    expect(select(['package.json']).unit.full).toBeTruthy();
    expect(select(['app/lib/csv.ts']).unit).toEqual({ files: ['app/lib/csv.ts'] });
  });

  it('runs a selection of browser specs without their wait for the cat specs', () => {
    const { e2e } = commands(select(['tests/e2e/survival.spec.ts']));
    expect(e2e).toBe('E2E_NO_CAT_DEPS=1 npx playwright test tests/e2e/survival.spec.ts');
    expect(commands(select(['playwright.config.ts'])).e2e).toBe('npx playwright test');
  });

  it('prints nothing to run when nothing needs it', () => {
    expect(commands(select(['docs/ai/README.md']))).toEqual({
      unit: null,
      database: null,
      e2e: null,
    });
  });

  it.each([
    'app/lib/data.ts',
    'tests/unit/data.test.ts',
    'db/migrations/0005_example.sql',
    'scripts/db.mjs',
  ])('names the opt-in database tests when %s changes', (file) => {
    const selection = select([file]);
    expect(selection.database).toEqual([file]);
    expect(commands(selection).database).toBe('DATABASE_TESTS=1 npx vitest run tests/unit/data');
  });

  it('does not name the database tests for a change they do not cover', () => {
    expect(select(['app/lib/actions.ts', 'app/ui/invoices/table.tsx']).database).toEqual([]);
  });
});
