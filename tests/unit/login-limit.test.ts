import type { Sql } from 'postgres';
import { describe, expect, it, vi } from 'vitest';
import { claimAttempt, clearFailures, loginKey, loginLimits } from '@/app/lib/login-limit';

// The lockout's settings, its decisions and the statements it sends. The
// statements themselves run against a real database in the browser test
// (tests/e2e/login-limit.spec.ts).

describe('loginLimits', () => {
  it('defaults to 5 failures and 15 minutes', () => {
    expect(loginLimits({})).toEqual({ maxFailures: 5, lockMinutes: 15 });
  });

  it('takes whole numbers above zero from the environment', () => {
    expect(loginLimits({ LOGIN_MAX_FAILURES: '3', LOGIN_LOCK_MINUTES: '60' })).toEqual({
      maxFailures: 3,
      lockMinutes: 60,
    });
  });

  it('falls back on anything else', () => {
    for (const value of ['', '0', '-2', '2.5', 'five', ' ']) {
      expect(loginLimits({ LOGIN_MAX_FAILURES: value, LOGIN_LOCK_MINUTES: value })).toEqual({
        maxFailures: 5,
        lockMinutes: 15,
      });
    }
  });
});

describe('loginKey', () => {
  it('counts an email however it is typed', () => {
    expect(loginKey('  User@NextMail.com ')).toBe('user@nextmail.com');
  });
});

/** A fake `sql` tag: records each statement's text and values, answers with `rows`. */
function fakeSql(rows: (call: number) => unknown[] = () => []) {
  const calls: { text: string; values: unknown[] }[] = [];
  const sql = vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ text: strings.join('?').replace(/\s+/g, ' ').trim(), values });
    return Promise.resolve(rows(calls.length));
  });
  return { sql: sql as unknown as Sql, calls };
}

const limits = { maxFailures: 3, lockMinutes: 20 };

describe('claimAttempt', () => {
  it('counts the attempt in one upsert, with N and M as values', async () => {
    const { sql, calls } = fakeSql(() => [{ attempt: 1 }]);
    await claimAttempt(sql, 'a@b.c', limits);
    expect(calls).toHaveLength(1);
    expect(calls[0].text).toMatch(/^INSERT INTO login_failures .* ON CONFLICT \(email\) DO UPDATE/);
    expect(calls[0].text).toContain('RETURNING failures AS attempt');
    // Parameters, never text: the email first, then only N and M.
    expect(calls[0].values[0]).toBe('a@b.c');
    expect(new Set(calls[0].values.slice(1))).toEqual(new Set([3, 20]));
  });

  it('lets the first N attempts compare a password, and no more', async () => {
    for (const [attempt, allowed] of [
      [1, true],
      [3, true],
      [4, false],
    ] as const) {
      expect(await claimAttempt(fakeSql(() => [{ attempt }]).sql, 'a@b.c', limits)).toBe(allowed);
    }
  });

  it('holds the limit when many attempts arrive at once', async () => {
    // The database numbers concurrent upserts one after another; so does this fake.
    const { sql } = fakeSql((call) => [{ attempt: call }]);
    const results = await Promise.all(
      Array.from({ length: limits.maxFailures + 3 }, () => claimAttempt(sql, 'a@b.c', limits))
    );
    expect(results.filter(Boolean)).toHaveLength(limits.maxFailures);
  });
});

describe('clearFailures', () => {
  it("forgets the email's attempts and any lock", async () => {
    const { sql, calls } = fakeSql();
    await clearFailures(sql, 'a@b.c');
    expect(calls).toEqual([
      { text: 'DELETE FROM login_failures WHERE email = ?', values: ['a@b.c'] },
    ]);
  });
});
