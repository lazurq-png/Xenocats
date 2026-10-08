import bcryptjs from 'bcryptjs';
import type { Sql } from 'postgres';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkCredentials } from '@/app/lib/credentials';
import { LOCKED } from '@/app/lib/login-limit';

// The sign-in's decision against a fake database: the lockout's count, the user
// lookup and the clearing of failures are answered here; bcrypt is real.

const limits = { maxFailures: 5, lockMinutes: 15 };

async function database(attempt = 1) {
  const user = {
    id: 'u1',
    name: 'User',
    email: 'user@nextmail.com',
    password: await bcryptjs.hash('123456', 10),
  };
  const statements: string[] = [];
  const sql = vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join('?');
    statements.push(text);
    if (text.includes('INSERT INTO login_failures')) return Promise.resolve([{ attempt }]);
    if (text.includes('FROM users')) {
      return Promise.resolve(values[0] === user.email ? [user] : []);
    }
    return Promise.resolve([]);
  }) as unknown as Sql;
  return { sql, user, statements };
}

describe('checkCredentials', () => {
  afterEach(() => vi.restoreAllMocks());

  it('the right password: the user, and the failures cleared', async () => {
    const { sql, user, statements } = await database();
    expect(await checkCredentials(sql, { email: user.email, password: '123456' }, limits)).toBe(
      user
    );
    expect(statements.some((s) => s.includes('DELETE FROM login_failures'))).toBe(true);
  });

  it('a wrong password, and an unknown email, are refused after the same one comparison', async () => {
    const { sql, user, statements } = await database();
    const compare = vi.spyOn(bcryptjs, 'compare');
    expect(
      await checkCredentials(sql, { email: user.email, password: 'wrong!!' }, limits)
    ).toBeNull();
    expect(compare).toHaveBeenCalledTimes(1);
    expect(
      await checkCredentials(sql, { email: 'nobody@nextmail.com', password: 'wrong!!' }, limits)
    ).toBeNull();
    // An unknown email still costs a comparison: the time tells nothing (D80).
    expect(compare).toHaveBeenCalledTimes(2);
    expect(statements.some((s) => s.includes('DELETE FROM login_failures'))).toBe(false);
  });

  it('a locked email is refused as locked, before any comparison', async () => {
    const { sql, user } = await database(6);
    const compare = vi.spyOn(bcryptjs, 'compare');
    expect(await checkCredentials(sql, { email: user.email, password: '123456' }, limits)).toBe(
      LOCKED
    );
    expect(compare).not.toHaveBeenCalled();
  });

  it('credentials that are not an email and a password reach nothing', async () => {
    const { sql, statements } = await database();
    for (const credentials of [{}, { email: 'not-an-email', password: '123456' }, null]) {
      expect(await checkCredentials(sql, credentials, limits)).toBeNull();
    }
    expect(statements).toEqual([]);
  });
});
