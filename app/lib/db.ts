import postgres from 'postgres';
import { databaseSsl } from '@/app/lib/db-ssl';

// The app's one database client, shared by every module that queries (auth.ts,
// actions.ts, data.ts, session-version.ts): one pool of connections per server
// instance rather than one each. It connects on the first query, not on import.
// TLS always; the certificate is checked on Vercel (app/lib/db-ssl.ts).
export const sql = postgres(process.env.POSTGRES_URL!, { ssl: databaseSsl() });
