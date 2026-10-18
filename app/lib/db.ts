import postgres from 'postgres';

// The app's one database client, shared by every module that queries (auth.ts,
// actions.ts, data.ts, session-version.ts): one pool of connections per server
// instance rather than one each. It connects on the first query, not on import.
export const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });
