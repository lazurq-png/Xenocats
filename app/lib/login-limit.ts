import type { Sql } from 'postgres';

// The login lockout: after `maxFailures` failed logins in a row for one email,
// that email is refused for `lockMinutes` minutes, right password or not. Counted
// per email whether or not a user has it, so it reveals nothing about which
// emails exist. Stored in `login_failures` (db/migrations/0004).
//
// Every attempt is counted *before* its password is compared, in one statement,
// so concurrent attempts cannot all slip past the check: each gets its own
// number, and only numbers 1..N are compared. The Nth sets the lock as it is
// counted. A success deletes the email's row, lock included; a lock that has run
// out starts the count again from 1.

/** The `code` of the error a locked-out login fails with (auth.ts, actions.ts). */
export const LOCKED = 'locked';

/**
 * N and M, from the environment (LOGIN_MAX_FAILURES, LOGIN_LOCK_MINUTES), each
 * a whole number above zero; anything else falls back to 5 failures, 15 minutes.
 */
export function loginLimits(env: Record<string, string | undefined> = process.env) {
  return {
    maxFailures: positiveInteger(env.LOGIN_MAX_FAILURES, 5),
    lockMinutes: positiveInteger(env.LOGIN_LOCK_MINUTES, 15),
  };
}

function positiveInteger(value: string | undefined, fallback: number) {
  const number = Number(value);
  return value && Number.isInteger(number) && number > 0 ? number : fallback;
}

/** The key an email is counted under: as typed, trimmed and lower-cased. */
export const loginKey = (email: string) => email.trim().toLowerCase();

/**
 * Counts an attempt for the email and says whether its password may be
 * compared: only while the email is not locked, and only for the first N
 * attempts since the last success or lockout.
 */
export async function claimAttempt(
  sql: Sql,
  key: string,
  { maxFailures, lockMinutes }: ReturnType<typeof loginLimits>
): Promise<boolean> {
  const [{ attempt }] = await sql<{ attempt: number }[]>`
    INSERT INTO login_failures AS f (email, failures, locked_until)
    VALUES (
      ${key},
      1,
      CASE WHEN 1 >= ${maxFailures} THEN now() + make_interval(mins => ${lockMinutes}) END
    )
    ON CONFLICT (email) DO UPDATE SET
      -- A lock that has run out starts the count again; otherwise one more.
      failures = CASE
        WHEN f.locked_until <= now() THEN 1
        ELSE f.failures + 1
      END,
      locked_until = CASE
        WHEN f.locked_until > now() THEN f.locked_until
        WHEN (CASE WHEN f.locked_until <= now() THEN 1 ELSE f.failures + 1 END) >= ${maxFailures}
          THEN now() + make_interval(mins => ${lockMinutes})
      END
    RETURNING failures AS attempt`;
  return attempt <= maxFailures;
}

/** Forgets the email's attempts (and any lock they set), after a successful login. */
export async function clearFailures(sql: Sql, key: string) {
  await sql`DELETE FROM login_failures WHERE email = ${key}`;
}
