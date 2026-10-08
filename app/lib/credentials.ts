import type { Sql } from 'postgres';
import { z } from 'zod';
import type { User } from '@/app/lib/definitions';
import { LOCKED, claimAttempt, clearFailures, loginKey, loginLimits } from '@/app/lib/login-limit';
import { passwordMatches } from '@/app/lib/password-check';

// The credentials sign-in's decision (auth.ts hands NextAuth what it says), kept
// apart so it can be tested with a fake database.

async function getUser(sql: Sql, email: string): Promise<User | undefined> {
  try {
    const user = await sql<User[]>`SELECT * FROM users WHERE email=${email}`;
    return user[0];
  } catch (error) {
    console.error('Failed to fetch user:', error);
    throw new Error('Failed to fetch user.');
  }
}

/**
 * Who `credentials` sign in as: the user, null for a refusal, or LOCKED for an
 * email locked out by too many failures.
 */
export async function checkCredentials(
  sql: Sql,
  credentials: unknown,
  limits: ReturnType<typeof loginLimits> = loginLimits()
): Promise<User | null | typeof LOCKED> {
  const parsedCredentials = z
    .object({ email: z.string().email(), password: z.string().min(6) })
    .safeParse(credentials);
  if (!parsedCredentials.success) return null;

  const { email, password } = parsedCredentials.data;
  const key = loginKey(email);
  // Counted before the password is looked at, so a locked email learns nothing
  // and concurrent attempts cannot get past the limit. An unknown email counts
  // like a wrong password.
  if (!(await claimAttempt(sql, key, limits))) return LOCKED;
  const user = await getUser(sql, email);
  // Compared even for an unknown email, so the time tells nothing (D80).
  const passwordsMatch = await passwordMatches(password, user?.password);
  if (user && passwordsMatch) {
    await clearFailures(sql, key);
    return user;
  }
  return null;
}
