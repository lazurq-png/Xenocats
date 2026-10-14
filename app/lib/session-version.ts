import postgres from 'postgres';

// Whether a session is still its account's (db/migrations/0008): the account still
// exists, and its session version is the one the session signed in with. Changing
// the password raises the version, which ends every session of the account. Asked
// on every request that reads a session (auth.config.ts), so it is one lookup by
// primary key.

let sql: postgres.Sql | null = null;

/**
 * Whether the session of `userId`, signed in at `version` (0 for one from before
 * versions), is still current. A database that cannot be asked answers no: signed
 * out rather than signed in on a session nobody could check.
 */
export async function isCurrentSession(userId: string, version: unknown): Promise<boolean> {
  try {
    sql ??= postgres(process.env.POSTGRES_URL!, { ssl: 'require' });
    const [user] = await sql<{ session_version: number }[]>`
      SELECT session_version FROM users WHERE id = ${userId}`;
    return !!user && user.session_version === (typeof version === 'number' ? version : 0);
  } catch (error) {
    console.error('Failed to check the session:', error);
    return false;
  }
}
