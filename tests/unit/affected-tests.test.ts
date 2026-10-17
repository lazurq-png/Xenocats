import { describe, expect, it } from 'vitest';
import { areaOf, commands, select, specAreas } from '@/scripts/affected-tests.mjs';

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
