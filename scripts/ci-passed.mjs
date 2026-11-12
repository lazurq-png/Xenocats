// Fails unless a Vitest JSON report (--reporter=json --outputFile.json=<file>) shows
// at least one test passed. CI's database tests skip themselves without
// DATABASE_TESTS or a POSTGRES_URL (tests/unit/data.test.ts), and a run that skips
// everything exits 0: this tells that apart from a real pass.
//
//   node scripts/ci-passed.mjs <report.json> [what the tests are, for the message]
import { readFileSync } from 'node:fs';

const [file, what = 'test'] = process.argv.slice(2);
if (!file) {
  console.error('usage: node scripts/ci-passed.mjs <report.json> [what]');
  process.exit(2);
}

let passed;
try {
  passed = JSON.parse(readFileSync(file, 'utf8')).numPassedTests;
} catch (error) {
  console.log(`::error::No readable Vitest report at ${file}: ${error.message}`);
  process.exit(1);
}

if (!Number.isInteger(passed) || passed < 1) {
  console.log(
    `::error::No ${what} passed: every one skipped (DATABASE_TESTS or POSTGRES_URL missing?)`
  );
  process.exit(1);
}
console.log(`${passed} ${what}(s) passed`);
