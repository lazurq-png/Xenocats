import type { Sql } from 'postgres';
import { z } from 'zod';
import type { User } from '@/app/lib/definitions';
import {
  ADDRESS_LOCKED,
  LOCKED,
  addressKey,
  addressLimits,
  claimAttempt,
  clearFailures,
  loginKey,
  loginLimits,
  pruneLoginFailures,
  refundAttempt,
} from '@/app/lib/login-limit';
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
 * Who `credentials` sign in as: the user, null for a refusal, LOCKED for a
 * login name locked out by too many failures, or ADDRESS_LOCKED for a client
 * address that is. The login name is a username, or an email for the accounts
 * that have one. `client` is the address's keyed hash (sign-up-limit.ts), or
 * null when no trusted proxy says where the request came from: then only the
 * login name is counted, since every such client would share one count and a
 * few strangers' typos would lock everyone out.
 */
export async function checkCredentials(
  sql: Sql,
  credentials: unknown,
  limits: ReturnType<typeof loginLimits> = loginLimits(),
  client: string | null = null,
  perAddress: ReturnType<typeof addressLimits> = addressLimits()
): Promise<User | null | typeof LOCKED | typeof ADDRESS_LOCKED> {
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
  // The address first: one address trying name after name is stopped there,
  // before it counts against (and locks) any of the names.
  const address = client === null ? null : addressKey(client);
  if (address && !(await claimAttempt(sql, address, perAddress))) return ADDRESS_LOCKED;
  // Counted before the password is looked at, so a locked name learns nothing
  // and concurrent attempts cannot get past the limit. An unknown name counts
  // like a wrong password.
  if (!(await claimAttempt(sql, key, limits))) return LOCKED;
  // On the way, the rows whose lock and count have both run out.
  await pruneLoginFailures(sql);
  const user = await getUser(sql, login);
  // Compared even for an unknown name, so the time tells nothing: answering
  // without bcrypt's ~0.1 s would show from outside which names have accounts.
  const passwordsMatch = await passwordMatches(password, user?.password);
  if (user && passwordsMatch) {
    await clearFailures(sql, key);
    if (address) await refundAttempt(sql, address, perAddress.maxFailures);
    return user;
  }
  return null;
}
