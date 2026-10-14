import postgres from 'postgres';

// Whether a session is still its account's: the account still exists, its session
// version is the one the session signed in with (changing the password raises it,
// which ends every session of the account; migration 0008), and the session was
// not signed out (its id is not in revoked_sessions; migration 0009). Asked on every
// request that reads a session (auth.config.ts), so it is one query, by keys.

let sql: postgres.Sql | null = null;
const db = () => (sql ??= postgres(process.env.POSTGRES_URL!, { ssl: 'require' }));

/**
 * Whether the session of `userId`, signed in at `version` (0 for one from before
 * versions) with the id `sessionId` (none for one from before ids), is still
 * current. A database that cannot be asked answers no: signed out rather than
 * signed in on a session nobody could check.
 */
export async function isCurrentSession(
  userId: string,
  version: unknown,
  sessionId: unknown
): Promise<boolean> {
  try {
    const [user] = await db()<{ session_version: number; revoked: boolean }[]>`
      SELECT session_version,
        EXISTS (SELECT 1 FROM revoked_sessions WHERE id = ${String(sessionId ?? '')}) AS revoked
      FROM users WHERE id = ${userId}`;
    return (
      !!user &&
      !user.revoked &&
      user.session_version === (typeof version === 'number' ? version : 0)
    );
  } catch (error) {
    console.error('Failed to check the session:', error);
    return false;
  }
}

/**
 * Ends the session `sessionId` for good, as signing out does, until `expiresAt`
 * (seconds since the epoch: the token's own expiry, after which it is refused
 * anyway). Revocations past their expiry are cleared on the way.
 */
export async function revokeSession(sessionId: string, expiresAt: number) {
  await db()`
    INSERT INTO revoked_sessions (id, expires_at) VALUES (${sessionId}, to_timestamp(${expiresAt}))
    ON CONFLICT (id) DO NOTHING`;
  await db()`DELETE FROM revoked_sessions WHERE expires_at < now()`;
}
