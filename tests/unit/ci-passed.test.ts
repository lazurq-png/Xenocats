import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// scripts/ci-passed.mjs: CI's database-tests step fails when its Vitest report
// shows nothing passed (every test skipped), not only when one failed.

const dir = mkdtempSync(join(tmpdir(), 'ci-passed-'));

function check(report: unknown) {
  const file = join(dir, `${Math.random().toString(36).slice(2)}.json`);
  if (report !== undefined) writeFileSync(file, JSON.stringify(report));
  const run = spawnSync(process.execPath, ['scripts/ci-passed.mjs', file, 'database test'], {
    encoding: 'utf8',
  });
  return { status: run.status, out: run.stdout };
}

describe('ci-passed', () => {
  it('passes a report with tests that passed', () => {
    const { status, out } = check({ numPassedTests: 52, numPendingTests: 0 });
    expect(status).toBe(0);
    expect(out).toContain('52 database test(s) passed');
  });

  it('fails a report where every test skipped', () => {
    const { status, out } = check({ numPassedTests: 0, numPendingTests: 52 });
    expect(status).toBe(1);
    expect(out).toContain('::error::No database test passed');
  });

  it('fails without a report, or with one that is not Vitest’s', () => {
    expect(check(undefined).status).toBe(1);
    expect(check({ something: 'else' }).status).toBe(1);
  });
});
