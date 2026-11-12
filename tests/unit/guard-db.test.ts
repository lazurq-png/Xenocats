import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as guard from '../../.claude/hooks/guard-db.mjs';

// The PreToolUse hook in .claude/settings.json: a seed or reset of a database
// outside the private network ranges is refused before it runs.

const { refusal, isPrivateHost, seedsOrResets } = guard as {
  refusal: (command: string, env: Record<string, string>, dir: string) => string | null;
  isPrivateHost: (host: string) => boolean;
  seedsOrResets: (command: string) => boolean;
};

const remote = 'postgres://u:p@ep-cold-sky.eu-central-1.aws.neon.tech/neondb?search_path=xenocats';
const local = 'postgres://u:p@localhost:5432/xenocats?search_path=xenocats';
const empty = mkdtempSync(join(tmpdir(), 'guard-db-'));

describe('the database guard', () => {
  it('knows a seed or a reset, by the npm scripts or db.mjs, from anything else', () => {
    for (const command of [
      'npm run db:seed',
      'npm run db:reset',
      'node scripts/db.mjs reset',
      'node --env-file=.env scripts/db.mjs seed',
    ]) {
      expect(seedsOrResets(command), command).toBe(true);
    }
    for (const command of ['npm run db:migrate', 'node scripts/db.mjs migrate', 'npm test']) {
      expect(seedsOrResets(command), command).toBe(false);
    }
  });

  it('refuses a seed or reset of a host on the internet, from the environment or the command', () => {
    expect(refusal('npm run db:seed', { POSTGRES_URL: remote }, empty)).toMatch(
      /Refusing to seed or reset ep-cold-sky.*not a private-network host/
    );
    expect(
      refusal(`POSTGRES_URL="${remote}" npm run db:reset`, { POSTGRES_URL: local }, empty)
    ).toMatch(/not a private-network host/);
    // PowerShell's and cmd's ways of setting it.
    for (const command of [
      `$env:POSTGRES_URL="${remote}"; npm run db:seed`,
      `set POSTGRES_URL=${remote}&& npm run db:seed`,
    ]) {
      expect(refusal(command, { POSTGRES_URL: local }, empty), command).toMatch(
        /not a private-network host/
      );
    }
  });

  it('lets a private host, a migration, or anything else run', () => {
    expect(refusal('npm run db:reset', { POSTGRES_URL: local }, empty)).toBeNull();
    expect(
      refusal('npm run db:seed', { POSTGRES_URL: remote.replace(/@[^/]+/, '@10.0.0.5') }, empty)
    ).toBeNull();
    expect(refusal('npm run db:migrate', { POSTGRES_URL: remote }, empty)).toBeNull();
    expect(refusal('git status', { POSTGRES_URL: remote }, empty)).toBeNull();
    // No URL anywhere: db.mjs fails on its own.
    expect(refusal('npm run db:seed', {}, empty)).toBeNull();
  });

  it('reads .env when the environment has no URL, as the npm scripts do', () => {
    const dir = mkdtempSync(join(tmpdir(), 'guard-db-env-'));
    writeFileSync(join(dir, '.env'), `AUTH_SECRET=x\nPOSTGRES_URL="${remote}"\n`);
    expect(refusal('npm run db:seed', {}, dir)).toMatch(/not a private-network host/);
  });

  it('holds the same private ranges as scripts/db.mjs', () => {
    for (const host of ['localhost', '127.0.0.1', '10.1.2.3', '192.168.0.240', '172.16.0.1']) {
      expect(isPrivateHost(host), host).toBe(true);
    }
    for (const host of ['172.32.0.1', '8.8.8.8', 'db.example.com', '10.example.com']) {
      expect(isPrivateHost(host), host).toBe(false);
    }
  });

  it('as the hook: exit 2 with the reason to block, 0 to let run', () => {
    const run = (command: string, url: string) =>
      spawnSync(process.execPath, ['.claude/hooks/guard-db.mjs'], {
        input: JSON.stringify({ tool_input: { command } }),
        env: { ...process.env, POSTGRES_URL: url, CLAUDE_PROJECT_DIR: empty },
        encoding: 'utf8',
      });
    const blocked = run('npm run db:seed', remote);
    expect(blocked.status).toBe(2);
    expect(blocked.stderr).toMatch(/not a private-network host/);
    expect(run('npm run db:seed', local).status).toBe(0);
    expect(run('git status', remote).status).toBe(0);
  });
});
