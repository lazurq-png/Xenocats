import { globSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// The unit tests, in projects chosen by where a file is and how it runs, so a new
// test file is in one without anyone naming it (CI runs each project as a step of
// its own, .github/workflows/ci.yml):
//
//   dashboard  tests/unit/ outside xenocats/: the dashboard, the login, the scripts, in Node
//   cats       tests/unit/xenocats/*: the cats and the game, in Node
//   jsdom      every file that asks for a browser's DOM (its first lines say
//              `@vitest-environment jsdom`), wherever it is
//   database   tests/unit/data.test.ts: the queries against a real database, opt-in
//              (DATABASE_TESTS=1; without it they skip)
const UNIT_TESTS = 'tests/unit/**/*.test.{ts,tsx}';
const DATABASE_TESTS = 'tests/unit/data.test.ts';

/** The test files that ask for jsdom, as paths from the repository's root. */
const inJsdom = globSync(UNIT_TESTS)
  .map((file) => file.replaceAll('\\', '/'))
  .filter((file) => /@vitest-environment\s+jsdom/.test(readFileSync(file, 'utf8').slice(0, 1000)));

export default defineConfig({
  resolve: {
    // Mirrors the "@/*" path in tsconfig.json.
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
  test: {
    environment: 'node',
    // Dates are formatted in the local zone; pin it so results match on every machine.
    env: { TZ: 'UTC' },
    projects: [
      {
        extends: true,
        test: {
          name: 'dashboard',
          // Any folder but the cats', so a new one needs no edit here either.
          include: [UNIT_TESTS],
          exclude: ['tests/unit/xenocats/**', DATABASE_TESTS, ...inJsdom],
        },
      },
      {
        extends: true,
        test: {
          name: 'cats',
          include: ['tests/unit/xenocats/**/*.test.{ts,tsx}'],
          exclude: inJsdom,
        },
      },
      { extends: true, test: { name: 'jsdom', include: inJsdom } },
      { extends: true, test: { name: 'database', include: [DATABASE_TESTS] } },
    ],
  },
});
