# Database Engineering Rules

Open this for schema, migration, and persistence work. Database changes are high-risk changes — treat existing data as valuable production state.

---

## This Repository

- **A development database, no production one yet.** `POSTGRES_URL` in `.env`
  points at a PostgreSQL on the local network whose data has no value. The app
  uses the schema the URL names in `?search_path=` (`xenocats`); the browser
  tests use `xenocats_test`, which they drop and rebuild on every run. Writing
  to either is ordinary development. The role cannot create tables in `public`.
- **Migrations** are numbered SQL files in `db/migrations/` (`0002_<what>.sql`
  next), applied in name order by `npm run db:migrate`, each in a transaction,
  and recorded in the schema's `schema_migrations` table. A schema change is a
  new file, never an edit to an applied one. `db:migrate` is also how a
  production database will be built, so a migration must work on a database
  that already has data: `ALTER`, not drop-and-recreate.
- **Seed data** is `app/lib/placeholder-data.ts`, loaded by `npm run db:seed`
  (idempotent) or `db:reset` (drop, migrate, seed). Both refuse a host that is
  not `localhost` or a private IP address; the seed includes a demo login that
  must never reach a public database. The check reads the URL, not the server:
  a tunnel to a remote server on `localhost` passes it, so never put a
  tunnelled production URL in `.env`.
- **CI has its own database**: the PostgreSQL preinstalled on the GitHub
  runner, started per job, migrated and seeded (`.github/workflows/ci.yml`).
  It is a fresh, empty server every run, so CI proves every migration applies
  from scratch.
- **A future production database** needs a connection that accepts
  `search_path` as a startup parameter (some poolers, e.g. PgBouncer by
  default, do not), or `ALTER ROLE ... SET search_path` instead. The app forces
  TLS (`ssl: 'require'`), so the server must offer it; the development one does.
- **Access is raw SQL** through the `postgres` library's tagged templates, in
  `app/lib/data.ts` (reads), `app/lib/actions.ts` (writes) and `auth.ts`. The
  template interpolation parameterises values. Never build a query with string
  concatenation or `sql.unsafe` (`scripts/db.mjs` runs migration files with it;
  they are repository code, not input).
- **Money is stored in cents** as integers. Convert at the edges only
  (`actions.ts` on the way in, `formatCurrency` on the way out).

---

## Schema Changes

Before modifying schema:

- inspect current schema
- inspect existing migrations
- inspect relevant queries
- inspect application assumptions
- identify constraints
- identify indexes
- identify existing data implications

Do not assume development data represents production.

---

## Migrations

Follow the repository's established migration system.

A migration should consider:

- existing rows
- nullability
- defaults
- indexes
- uniqueness
- foreign keys
- data conversion
- rollback
- deployment order
- application compatibility

Avoid migrations that require the application to stop functioning during deployment unless that is explicitly intended.

---

## Expand-and-Contract

For risky production changes, prefer compatible migration phases when appropriate:

```text
expand
  ↓
deploy compatible application
  ↓
backfill/migrate
  ↓
switch reads/writes
  ↓
contract
```

Do not immediately remove old columns or fields if old application versions may still depend on them.

---

## Data Integrity

Preserve invariants.

Consider:

- uniqueness
- foreign keys
- check constraints
- required values
- ownership
- tenant boundaries
- deletion behavior

Prefer database-level guarantees where appropriate.

---

## Queries

Use existing data-access abstractions.

Consider:

- N+1 queries
- unbounded result sets
- pagination
- indexes
- filtering
- sorting
- transaction boundaries

Do not load an entire large table when a bounded query is appropriate.

---

## Production Safety

Never:

- hard-code production credentials
- directly mutate production data during ordinary development
- delete production data to make tests pass
- assume production is disposable

Use approved tooling and processes for production operations.

---

## Backfills

For large datasets, consider:

- batching
- resumability
- locking
- load
- observability
- partial failure
- idempotency

Do not write a one-shot migration that assumes a tiny dataset unless that assumption is guaranteed.

---

## Verification

After database changes:

- run migration tests where available
- test relevant queries
- verify schema generation
- verify application compatibility
- inspect generated artifacts
- test important rollback/forward paths when practical
