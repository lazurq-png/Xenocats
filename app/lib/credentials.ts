import type { Sql } from 'postgres';
import { z } from 'zod';
import type { User } from '@/app/lib/definitions';
import { LOCKED, claimAttempt, clearFailures, loginKey, loginLimits } from '@/app/lib/login-limit';
import { passwordMatches } from '@/app/lib/password-check';
import { USERNAME_PATTERN } from '@/app/lib/schemas';

// The credentials sign-in's decision (auth.ts hands NextAuth what it says), kept
// apart so it can be tested with a fake database.

/**
 * The user a login name names: an email when it has an '@' (a username never
 * does, migration 0006), otherwise a username, whatever its case.
 */
async function getUser(sql: Sql, login: string): Promise<User | undefined> {
  try {
    const user = login.includes('@')
      ? await sql<User[]>`SELECT * FROM users WHERE email=${login}`
      : await sql<User[]>`SELECT * FROM users WHERE lower(username)=lower(${login})`;
    return user[0];
  } catch (error) {
    console.error('Failed to fetch user:', error);
    throw new Error('Failed to fetch user.');
  }
}

/**
 * Who `credentials` sign in as: the user, null for a refusal, or LOCKED for a
 * login name locked out by too many failures. The login name is a username, or
 * an email for the accounts that have one.
 */
export async function checkCredentials(
  sql: Sql,
  credentials: unknown,
  limits: ReturnType<typeof loginLimits> = loginLimits()
): Promise<User | null | typeof LOCKED> {
  // A username or an email, nothing else: so a login name is never counted under
  // another lockout's key (`change-password:<id>`), nor fills the table with junk.
  const loginName = z
    .string()
    .trim()
    .max(255)
    .refine((login) => USERNAME_PATTERN.test(login) || z.string().email().safeParse(login).success);
  const parsedCredentials = z
    .object({
      login: loginName,
      // At most bcrypt's 72 bytes, as every stored password is: a longer one is never right.
      password: z
        .string()
        .min(6)
        .refine((password) => new TextEncoder().encode(password).length <= 72),
    })
    .safeParse(credentials);
  if (!parsedCredentials.success) return null;

  const { login, password } = parsedCredentials.data;
  // Prefixed, so a login's count never shares a key with another lockout's
  // (`change-password:<id>`), whatever a login name may look like in the future.
  const key = `login:${loginKey(login)}`;
  // Counted before the password is looked at, so a locked name learns nothing
  // and concurrent attempts cannot get past the limit. An unknown name counts
  // like a wrong password.
  if (!(await claimAttempt(sql, key, limits))) return LOCKED;
  const user = await getUser(sql, login);
  // Compared even for an unknown name, so the time tells nothing (D80).
  const passwordsMatch = await passwordMatches(password, user?.password);
  if (user && passwordsMatch) {
    await clearFailures(sql, key);
    return user;
  }
  return null;
}
