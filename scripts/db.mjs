// Builds and fills the database named by POSTGRES_URL.
//
// Usage: node scripts/db.mjs migrate|seed|reset   (npm run db:migrate, db:seed, db:reset)
//
// The URL must name a schema, e.g. postgres://u:p@host:5432/db?sslmode=require&search_path=xenocats.
// The app's tables live in that schema, never in `public`.
//
//   migrate  applies db/migrations/*.sql not yet recorded in schema_migrations, in
//            name order, each in its own transaction. Safe on any database.
//   seed     loads app/lib/placeholder-data.ts (including its demo login). Idempotent.
//   reset    drops the schema, then migrate and seed.
//
// seed and reset refuse a host outside the private network ranges: a database
// on the internet is assumed to be a real one, and neither demo data nor a drop
// belongs there.

import { readdir, readFile } from 'node:fs/promises';
import { isIP } from 'node:net';
import bcryptjs from 'bcryptjs';
import postgres from 'postgres';

const MIGRATIONS = new URL('../db/migrations/', import.meta.url);

function fail(message) {
  console.error(`db: ${message}`);
  process.exitCode = 1;
}

// IP literals only, so a name like 10.example.com is not mistaken for one. A
// tunnel (localhost forwarded to a remote server) still passes: never put a
// tunnelled production URL in .env.
function isPrivateHost(host) {
  if (host === 'localhost') return true;
  if (isIP(host) !== 4) return false;
  return (
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  );
}

async function migrate(sql, schema) {
  await sql`CREATE SCHEMA IF NOT EXISTS ${sql(schema)}`;
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  const applied = new Set((await sql`SELECT name FROM schema_migrations`).map((row) => row.name));
  const files = (await readdir(MIGRATIONS)).filter((name) => name.endsWith('.sql')).sort();
  for (const name of files.filter((file) => !applied.has(file))) {
    const body = await readFile(new URL(name, MIGRATIONS), 'utf8');
    await sql.begin(async (tx) => {
      // A migration file is trusted repository code, not input; unsafe() is
      // how postgres.js runs a multi-statement script.
      await tx.unsafe(body);
      await tx`INSERT INTO schema_migrations (name) VALUES (${name})`;
    });
    console.log(`db: applied ${name}`);
  }
  console.log(`db: schema "${schema}" is up to date (${files.length} migrations)`);
}

async function seed(sql, schema) {
  const { users, customers, invoices, revenue } = await import('../app/lib/placeholder-data.ts');
  await sql.begin(async (tx) => {
    for (const user of users) {
      const password = await bcryptjs.hash(user.password, 10);
      await tx`
        INSERT INTO users (id, name, email, password)
        VALUES (${user.id}, ${user.name}, ${user.email}, ${password})
        ON CONFLICT (id) DO NOTHING`;
    }
    for (const customer of customers) {
      await tx`
        INSERT INTO customers (id, name, email, image_url)
        VALUES (${customer.id}, ${customer.name}, ${customer.email}, ${customer.image_url})
        ON CONFLICT (id) DO NOTHING`;
    }
    // Invoices have no fixed ids, so only an empty table is filled: seeding twice
    // must not duplicate them.
    const [{ count }] = await tx`SELECT count(*)::int AS count FROM invoices`;
    if (count === 0) {
      for (const invoice of invoices) {
        await tx`
          INSERT INTO invoices (customer_id, amount, status, date)
          VALUES (${invoice.customer_id}, ${invoice.amount}, ${invoice.status}, ${invoice.date})`;
      }
    }
    for (const row of revenue) {
      await tx`
        INSERT INTO revenue (month, revenue) VALUES (${row.month}, ${row.revenue})
        ON CONFLICT (month) DO NOTHING`;
    }
  });
  console.log(`db: seeded schema "${schema}"`);
}

async function main(command) {
  if (!['migrate', 'seed', 'reset'].includes(command)) {
    return fail('usage: node scripts/db.mjs migrate|seed|reset');
  }
  if (!process.env.POSTGRES_URL) return fail('POSTGRES_URL is not set');

  const url = new URL(process.env.POSTGRES_URL);
  const schema = url.searchParams.get('search_path');
  if (!schema || !/^[a-z_][a-z0-9_]*$/.test(schema) || schema === 'public') {
    return fail('POSTGRES_URL needs a search_path naming one schema other than public');
  }
  if (command !== 'migrate' && !isPrivateHost(url.hostname)) {
    return fail(`refusing to ${command} ${url.hostname}: not a private-network host`);
  }

  const sql = postgres(process.env.POSTGRES_URL, { max: 1, onnotice: () => {} });
  try {
    if (command === 'reset') {
      await sql`DROP SCHEMA IF EXISTS ${sql(schema)} CASCADE`;
      console.log(`db: dropped schema "${schema}"`);
    }
    if (command !== 'seed') await migrate(sql, schema);
    if (command !== 'migrate') await seed(sql, schema);
  } finally {
    await sql.end();
  }
}

await main(process.argv[2]).catch((error) => fail(error.message));
