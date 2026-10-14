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
    username: 'Stargazer',
    password: await bcryptjs.hash('123456', 10),
  };
  const statements: string[] = [];
  const sql = vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join('?');
    statements.push(text);
    if (text.includes('INSERT INTO login_failures')) return Promise.resolve([{ attempt }]);
    if (text.includes('FROM users WHERE email')) {
      return Promise.resolve(values[0] === user.email ? [user] : []);
    }
    if (text.includes('FROM users WHERE lower(username)')) {
      const name = String(values[0]).toLowerCase();
      return Promise.resolve(name === user.username.toLowerCase() ? [user] : []);
    }
    return Promise.resolve([]);
  }) as unknown as Sql;
  return { sql, user, statements };
}

describe('checkCredentials', () => {
  afterEach(() => vi.restoreAllMocks());

  it('the right password: the user, and the failures cleared', async () => {
    const { sql, user, statements } = await database();
    expect(await checkCredentials(sql, { login: user.email, password: '123456' }, limits)).toBe(
      user
    );
    expect(statements.some((s) => s.includes('DELETE FROM login_failures'))).toBe(true);
  });

  it('counts a login under its own prefix, apart from every other lockout', async () => {
    const { sql } = await database();
    await checkCredentials(sql, { login: ' Stargazer ', password: 'wrong!!' }, limits);
    const calls = (sql as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    expect(calls[0][1]).toBe('login:stargazer');
  });

  it('a wrong password, and an unknown email, are refused after the same one comparison', async () => {
    const { sql, user, statements } = await database();
    const compare = vi.spyOn(bcryptjs, 'compare');
    expect(
      await checkCredentials(sql, { login: user.email, password: 'wrong!!' }, limits)
    ).toBeNull();
    expect(compare).toHaveBeenCalledTimes(1);
    expect(
      await checkCredentials(sql, { login: 'nobody@nextmail.com', password: 'wrong!!' }, limits)
    ).toBeNull();
    // An unknown email still costs a comparison: the time tells nothing (D80).
    expect(compare).toHaveBeenCalledTimes(2);
    expect(statements.some((s) => s.includes('DELETE FROM login_failures'))).toBe(false);
  });

  it('a locked email is refused as locked, before any comparison', async () => {
    const { sql, user } = await database(6);
    const compare = vi.spyOn(bcryptjs, 'compare');
    expect(await checkCredentials(sql, { login: user.email, password: '123456' }, limits)).toBe(
      LOCKED
    );
    expect(compare).not.toHaveBeenCalled();
  });

  it('a username signs in whatever its case, and is counted under it lower-cased', async () => {
    const { sql, user, statements } = await database();
    expect(await checkCredentials(sql, { login: ' stargazer ', password: '123456' }, limits)).toBe(
      user
    );
    expect(statements.some((s) => s.includes('lower(username)'))).toBe(true);
    expect(await checkCredentials(sql, { login: 'nobody', password: '123456' }, limits)).toBeNull();
  });

  it('credentials that are not a login name and a password reach nothing', async () => {
    const { sql, statements } = await database();
    const longName = 'x'.repeat(256);
    for (const credentials of [
      {},
      { login: '   ', password: '123456' },
      { login: longName, password: '123456' },
      { login: 'Stargazer', password: '12345' },
      // Neither a username nor an email: never counted, so never under another
      // lockout's key (the password change's).
      { login: 'change-password:410544b2-4001-4271-9855-fec4b6a6442a', password: '123456' },
      { login: 'not an email', password: '123456' },
      // Longer than bcrypt's 72 bytes, which no stored password is.
      { login: 'Stargazer', password: 'x'.repeat(73) },
      // The form's field before usernames: no login name at all.
      { email: 'user@nextmail.com', password: '123456' },
      null,
    ]) {
      expect(await checkCredentials(sql, credentials, limits)).toBeNull();
    }
    expect(statements).toEqual([]);
  });
});
