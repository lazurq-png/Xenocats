// CI only: readies the PostgreSQL service container a browser-test job runs next
// to (.github/workflows/ci.yml), the way the app needs it.
//
// - TLS on. The app connects with `ssl: 'require'`, and a service container
//   cannot be given server flags, so it is switched on here, with the snakeoil
//   certificate the image's Debian packages generate, and a configuration reload.
// - POSTGRES_URL by address, not by the service's name: `db:seed` refuses any
//   host that is not localhost or a private address (scripts/db.mjs), and the
//   container's address on the job's network is a private one. The URL goes to
//   $GITHUB_ENV for the steps after this one.
//
// Usage: node scripts/ci-database.mjs <service host> <search_path>

import { appendFileSync } from 'node:fs';
import { lookup } from 'node:dns/promises';
import postgres from 'postgres';

const [host = 'postgres', schema = 'xenocats'] = process.argv.slice(2);
const credentials = 'postgres:postgres';
const { address } = await lookup(host, { family: 4 });

const admin = postgres(`postgres://${credentials}@${address}:5432/postgres`, { ssl: false });
await admin`ALTER SYSTEM SET ssl_cert_file = '/etc/ssl/certs/ssl-cert-snakeoil.pem'`;
await admin`ALTER SYSTEM SET ssl_key_file = '/etc/ssl/private/ssl-cert-snakeoil.key'`;
await admin`ALTER SYSTEM SET ssl = on`;
await admin`SELECT pg_reload_conf()`;
await admin.end();

// The reload is asynchronous: wait until a TLS connection gets through.
const url = `postgres://${credentials}@${address}:5432/postgres?sslmode=require&search_path=${schema}`;
let ssl = 'off';
for (let attempt = 0; attempt < 20 && ssl !== 'on'; attempt++) {
  try {
    const tls = postgres(url, { ssl: 'require', max: 1 });
    [{ ssl }] = await tls`SHOW ssl`;
    await tls.end();
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}
if (ssl !== 'on') throw new Error('PostgreSQL did not turn TLS on');

appendFileSync(process.env.GITHUB_ENV, `POSTGRES_URL=${url}\n`);
console.log(`PostgreSQL at ${address}, TLS on; POSTGRES_URL set (search_path=${schema})`);
