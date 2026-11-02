import bcryptjs from 'bcryptjs';
import type { Sql } from 'postgres';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkCredentials } from '@/app/lib/credentials';
import { ADDRESS_LOCKED, LOCKED } from '@/app/lib/login-limit';

// The sign-in's decision against a fake database: the lockout's count, the user
// lookup and the clearing of failures are answered here; bcrypt is real.

const limits = { maxFailures: 5, lockMinutes: 15 };
const perAddress = { maxFailures: 20, lockMinutes: 15, forgetAfterMinutes: 15 };

async function database(attempt = 1, addressAttempt = 1) {
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
    if (text.includes('INSERT INTO login_failures')) {
      const address = String(values[0]).startsWith('login-address:');
      return Promise.resolve([{ attempt: address ? addressAttempt : attempt }]);
    }
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
    expect(statements.some((s) => s.includes('DELETE FROM login_failures WHERE email'))).toBe(true);
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
    // An unknown email still costs a comparison: the time tells nothing, so it cannot
    // show which emails have accounts.
    expect(compare).toHaveBeenCalledTimes(2);
    expect(statements.some((s) => s.includes('DELETE FROM login_failures WHERE email'))).toBe(
      false
    );
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

  describe('with the client address a trusted proxy gave', () => {
    const calls = (sql: Sql) =>
      (sql as unknown as { mock: { calls: [TemplateStringsArray, ...unknown[]][] } }).mock.calls;
    const keys = (sql: Sql) =>
      calls(sql)
        .filter(([strings]) => strings.join('?').includes('INSERT INTO login_failures'))
        .map(([, key]) => key);

    it('counts the address first, under a prefix of its own, then the name', async () => {
      const { sql } = await database();
      await checkCredentials(
        sql,
        { login: 'Stargazer', password: 'wrong!!' },
        limits,
        'abc',
        perAddress
      );
      expect(keys(sql)).toEqual(['login-address:abc', 'login:stargazer']);
    });

    it('a locked address is refused before the name is counted or any comparison', async () => {
      const { sql, user } = await database(1, 21);
      const compare = vi.spyOn(bcryptjs, 'compare');
      expect(
        await checkCredentials(
          sql,
          { login: user.email, password: '123456' },
          limits,
          'abc',
          perAddress
        )
      ).toBe(ADDRESS_LOCKED);
      expect(keys(sql)).toEqual(['login-address:abc']);
      expect(compare).not.toHaveBeenCalled();
    });

    it('a success gives back its own attempt for the address, and clears the name', async () => {
      const { sql, user, statements } = await database();
      expect(
        await checkCredentials(
          sql,
          { login: user.email, password: '123456' },
          limits,
          'abc',
          perAddress
        )
      ).toBe(user);
      const refund = calls(sql).find(([strings]) =>
        strings.join('?').includes('greatest(failures - 1')
      );
      expect(refund?.slice(1)).toEqual([perAddress.maxFailures, 'login-address:abc']);
      expect(statements.some((s) => s.includes('DELETE FROM login_failures WHERE email'))).toBe(
        true
      );
    });

    it('a failure keeps the address counted', async () => {
      const { sql, user, statements } = await database();
      await checkCredentials(
        sql,
        { login: user.email, password: 'wrong!!' },
        limits,
        'abc',
        perAddress
      );
      expect(statements.some((s) => s.includes('greatest(failures - 1'))).toBe(false);
    });

    it('prunes the spent rows on the way, and a failed prune fails no login', async () => {
      const { sql, user, statements } = await database();
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      const prune = /DELETE FROM login_failures\s+WHERE locked_until/;
      const failing = ((strings: TemplateStringsArray, ...values: unknown[]) =>
        prune.test(strings.join('?'))
          ? Promise.reject(new Error('lock timeout'))
          : (sql as unknown as (s: TemplateStringsArray, ...v: unknown[]) => unknown)(
              strings,
              ...values
            )) as unknown as Sql;
      expect(
        await checkCredentials(
          failing,
          { login: user.email, password: '123456' },
          limits,
          'abc',
          perAddress
        )
      ).toBe(user);
      expect(statements.some((s) => prune.test(s))).toBe(false);
      expect(error).toHaveBeenCalledWith('Failed to prune login failures:', expect.any(Error));
      // And without a failure, the prune is sent.
      await checkCredentials(
        sql,
        { login: user.email, password: '123456' },
        limits,
        'abc',
        perAddress
      );
      expect(statements.some((s) => prune.test(s))).toBe(true);
    });

    it('with no trusted proxy, only the name is counted', async () => {
      const { sql } = await database();
      await checkCredentials(
        sql,
        { login: 'Stargazer', password: 'wrong!!' },
        limits,
        null,
        perAddress
      );
      expect(keys(sql)).toEqual(['login:stargazer']);
    });
  });
});
