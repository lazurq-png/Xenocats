import postgres from 'postgres';
import { databaseSsl } from '@/app/lib/db-ssl';

// The app's one database client, shared by every module that queries (auth.ts,
// actions.ts, data.ts, session-version.ts): one pool of connections per server
// instance rather than one each. It connects on the first query, not on import.
// TLS always; the certificate is checked on Vercel (app/lib/db-ssl.ts).
// Its sessions run on UTC: the app dates invoices by the UTC day, and so
// CURRENT_DATE (the overdue rule, "due in N days") is that day too, whatever the
// server's own time zone.
export const sql = postgres(process.env.POSTGRES_URL!, {
  ssl: databaseSsl(),
  connection: { TimeZone: 'UTC' },
});
