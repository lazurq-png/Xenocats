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
  });

  it('reads the areas a spec visits, from strings and URL regexes', () => {
    const areas = ['/', '/cats', '/dashboard', '/dashboard/invoices', '/login'];
    expect(specAreas(`await page.goto('/dashboard/invoices?page=2');`, areas)).toEqual([
      '/dashboard/invoices',
    ]);
    expect(specAreas(`await expect(page).toHaveURL(/\\/dashboard$/);`, areas)).toEqual([
      '/dashboard',
    ]);
    expect(specAreas(`page.goto('/')`, areas)).toEqual(['/']);
    // A page under an area counts for it (the games are pages of /cats).
    expect(specAreas(`await page.goto('/cats/survival' + query);`, areas)).toEqual(['/cats']);
    // An asset path is not a route.
    expect(specAreas(`'/xenocats/cats/tabby.png'`, areas)).toEqual([]);
  });

  it('gives every spec an area, so a targeted run can reach each one', () => {
    for (const spec of select([]).specs) expect(spec.areas, spec.file).not.toEqual([]);
  });

  it('runs the specs of the area a component reaches, and not the others', () => {
    const { e2e } = select(['app/ui/invoices/table.tsx']);
    expect(e2e.specs).toContain('tests/e2e/invoices.spec.ts');
    expect(e2e.specs).not.toContain('tests/e2e/fight.spec.ts');
  });

  it('runs a changed spec itself, and no browser test for a unit test or a document', () => {
    expect(select(['tests/e2e/fight.spec.ts']).e2e).toEqual({ specs: ['tests/e2e/fight.spec.ts'] });
    expect(select(['tests/unit/csv.test.ts', 'docs/ai/README.md']).e2e).toEqual({ specs: [] });
  });

  it.each([
    'app/ui/global.css', // the root layout
    'auth.ts',
    'proxy.ts',
    'app/lib/placeholder-data.ts',
    'tailwind.config.ts',
    'next.config.ts',
    'tests/e2e/global-setup.ts',
    'app/ui/no-such-file.tsx', // deleted
  ])('runs the whole browser suite for %s', (file) => {
    expect(select([file]).e2e.full).toBeTruthy();
  });

  it('runs the whole unit suite when its configuration changes', () => {
    expect(select(['vitest.config.mts']).unit.full).toBeTruthy();
    expect(select(['package.json']).unit.full).toBeTruthy();
    expect(select(['app/lib/csv.ts']).unit).toEqual({ files: ['app/lib/csv.ts'] });
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
