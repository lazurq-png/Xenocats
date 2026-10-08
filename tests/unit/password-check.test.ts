import bcryptjs from 'bcryptjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BCRYPT_COST, passwordMatches } from '@/app/lib/password-check';

describe('passwordMatches', () => {
  afterEach(() => vi.restoreAllMocks());

  it('is true for the password a hash was made from, false for any other', async () => {
    const hash = await bcryptjs.hash('123456', BCRYPT_COST);
    expect(await passwordMatches('123456', hash)).toBe(true);
    expect(await passwordMatches('654321', hash)).toBe(false);
  });

  it('for an unknown email (no hash) still compares, at the same cost, and says no', async () => {
    const compare = vi.spyOn(bcryptjs, 'compare');
    expect(await passwordMatches('123456', undefined)).toBe(false);
    expect(compare).toHaveBeenCalledTimes(1);
    const [password, against] = compare.mock.calls[0] as [string, string];
    expect(password).toBe('123456');
    // A real bcrypt hash at the stored hashes' cost: the same work as a wrong password.
    expect(bcryptjs.getRounds(against)).toBe(BCRYPT_COST);
    // Not one any password a person would type is likely to match: never true.
    expect(await passwordMatches('', undefined)).toBe(false);
  });

  it('the stored hashes are made at that cost (the seed and the password change)', async () => {
    const { readFileSync } = await import('node:fs');
    expect(readFileSync('scripts/db.mjs', 'utf8')).toMatch(/bcryptjs\.hash\(user\.password, 10\)/);
    expect(BCRYPT_COST).toBe(10);
  });
});
