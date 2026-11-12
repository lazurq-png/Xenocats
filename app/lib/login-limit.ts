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
//
// In front of it, one client address's attempts are counted the same way, under
// a key of its own (`addressKey`), so one address cannot try name after name,
// nor lock name after name. A success gives back its own attempt rather than
// clearing the address's count (an account of the client's own would clear it
// otherwise), and the count is forgotten after `lockMinutes` without an attempt.
// Rows whose lock and count have both run out are pruned (`pruneLoginFailures`).

/** The `code` of the error a locked-out login fails with (auth.ts, actions.ts). */
export const LOCKED = 'locked';

/** The `code` of the error a login from a locked-out client address fails with. */
export const ADDRESS_LOCKED = 'address-locked';

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

/**
 * One client address's limit: LOGIN_ADDRESS_MAX_FAILURES failed logins (else 20)
 * before it is refused for the same LOGIN_LOCK_MINUTES, and its count forgotten
 * after that long without an attempt.
 */
export function addressLimits(env: Record<string, string | undefined> = process.env) {
  const { lockMinutes } = loginLimits(env);
  return {
    maxFailures: positiveInteger(env.LOGIN_ADDRESS_MAX_FAILURES, 20),
    lockMinutes,
    forgetAfterMinutes: lockMinutes,
  };
}

/** A whole number above zero from the environment, or `fallback`. */
export function positiveInteger(value: string | undefined, fallback: number) {
  const number = Number(value);
  return value && Number.isInteger(number) && number > 0 ? number : fallback;
}

/** The key an email is counted under: as typed, trimmed and lower-cased. */
export const loginKey = (email: string) => email.trim().toLowerCase();

/**
 * The key a client address is counted under, from its keyed hash (`clientKey` in
 * sign-up-limit.ts): prefixed, so it never shares a key with a login name's.
 */
export const addressKey = (client: string) => `login-address:${client}`;

type Limits = ReturnType<typeof loginLimits> & { forgetAfterMinutes?: number };

/**
 * Counts an attempt for the key and says whether its password may be compared:
 * only while the key is not locked, and only for the first N attempts since the
 * last success or lockout (or, with `forgetAfterMinutes`, since a quiet spell
 * that long).
 */
export async function claimAttempt(
  sql: Sql,
  key: string,
  { maxFailures, lockMinutes, forgetAfterMinutes }: Limits
): Promise<boolean> {
  const forget = forgetAfterMinutes ?? null;
  const [{ attempt }] = await sql<{ attempt: number }[]>`
    INSERT INTO login_failures AS f (email, failures, locked_until, last_attempt)
    VALUES (
      ${key},
      1,
      CASE WHEN 1 >= ${maxFailures} THEN now() + make_interval(mins => ${lockMinutes}) END,
      now()
    )
    ON CONFLICT (email) DO UPDATE SET
      -- A lock that has run out, or a count left quiet for long enough, starts the
      -- count again; otherwise one more.
      -- (A quiet spell never ends a lock that is still running.)
      failures = CASE
        WHEN f.locked_until <= now()
          OR (f.locked_until IS NULL
            AND f.last_attempt <= now() - make_interval(mins => ${forget}::int)) THEN 1
        ELSE f.failures + 1
      END,
      locked_until = CASE
        WHEN f.locked_until > now() THEN f.locked_until
        WHEN (CASE
          WHEN f.locked_until <= now()
            OR (f.locked_until IS NULL
              AND f.last_attempt <= now() - make_interval(mins => ${forget}::int)) THEN 1
          ELSE f.failures + 1
        END) >= ${maxFailures}
          THEN now() + make_interval(mins => ${lockMinutes})
      END,
      last_attempt = now()
    RETURNING failures AS attempt`;
  return attempt <= maxFailures;
}

/** Forgets the email's attempts (and any lock they set), after a successful login. */
export async function clearFailures(sql: Sql, key: string) {
  await sql`DELETE FROM login_failures WHERE email = ${key}`;
}

/**
 * Gives back one attempt a successful login counted for the key, and the lock
 * that attempt set if it was the Nth: the key's other failures still count.
 */
export async function refundAttempt(sql: Sql, key: string, maxFailures: number) {
  await sql`
    UPDATE login_failures SET
      failures = greatest(failures - 1, 0),
      locked_until = CASE WHEN failures - 1 < ${maxFailures} THEN NULL ELSE locked_until END
    WHERE email = ${key}`;
}

/**
 * Deletes the rows that no longer hold anything: a lock that has run out (the
 * next attempt would start again from 1 anyway), or no lock and no attempt for a
 * day. Housekeeping only: a failure is logged, never passed on, so it cannot
 * fail the login it runs in.
 */
export async function pruneLoginFailures(sql: Sql) {
  try {
    await sql`
      DELETE FROM login_failures
      WHERE locked_until <= now()
        OR (locked_until IS NULL AND last_attempt <= now() - interval '1 day')`;
  } catch (error) {
    console.error('Failed to prune login failures:', error);
  }
}
