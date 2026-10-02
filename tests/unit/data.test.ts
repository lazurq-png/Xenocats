import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { percentChange } from '@/app/lib/dashboard';
import { customers, invoices } from '@/app/lib/placeholder-data';
import { formatCurrency } from '@/app/lib/utils';

// Every query in app/lib/data.ts (and the login lockout's statements) against a
// real database: its own schema,
// `xenocats_vitest`, on the server POSTGRES_URL names (the environment's, else
// .env's), rebuilt from db/migrations and the seed before this file runs. The
// browser tests use `xenocats_test`, so the two suites never meet. Like them,
// these skip without a URL, or with E2E_NO_DATABASE=1 (the server is unreachable).
// The expected values are worked out from the seed (placeholder-data.ts).

function databaseUrl(schema: string): string | null {
  if (process.env.E2E_NO_DATABASE) return null;
  let base = process.env.POSTGRES_URL;
  if (!base) {
    try {
      // Read, not loaded: this process's own environment stays as it was.
      base = (parseEnv(readFileSync('.env', 'utf8')) as NodeJS.Dict<string>).POSTGRES_URL;
    } catch {
      // No .env: only the environment counts.
    }
  }
  if (!base) return null;
  const url = new URL(base);
  url.searchParams.set('search_path', schema);
  return url.toString();
}

const url = databaseUrl('xenocats_vitest');

/** 'YYYY-MM-DD' for a DATE column, which postgres.js reads as a UTC-midnight Date. */
const day = (value: unknown) => new Date(value as string).toISOString().slice(0, 10);
const sum = (rows: { amount: number }[]) => rows.reduce((total, row) => total + row.amount, 0);
const paid = invoices.filter((invoice) => invoice.status === 'paid');
const pending = invoices.filter((invoice) => invoice.status === 'pending');
const newestFirst = [...invoices].sort((a, b) => b.date.localeCompare(a.date));
const customerOf = (invoice: (typeof invoices)[number]) =>
  customers.find((customer) => customer.id === invoice.customer_id)!;
// Every seeded invoice is from 2022–2023: every unpaid one is past its due date.
const today = new Date().toISOString().slice(0, 10);
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

describe.skipIf(!url)('the queries in app/lib/data.ts', () => {
  let data: typeof import('@/app/lib/data');

  beforeAll(async () => {
    execFileSync(
      process.execPath,
      ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', 'scripts/db.mjs', 'reset'],
      { env: { ...process.env, POSTGRES_URL: url! }, stdio: 'pipe' }
    );
    // data.ts connects to POSTGRES_URL when it is first imported.
    process.env.POSTGRES_URL = url!;
    data = await import('@/app/lib/data');
  }, 60_000);

  describe('on the seed alone', () => {
    it('fetchLatestInvoices: the five newest, formatted, overdue when unpaid and past due', async () => {
      const latest = await data.fetchLatestInvoices();
      expect(latest.map((row) => day(row.date))).toEqual(
        newestFirst.slice(0, 5).map((invoice) => invoice.date)
      );
      for (const [i, row] of latest.entries()) {
        const seeded = newestFirst[i];
        expect(row.amount).toBe(formatCurrency(seeded.amount));
        expect(row.name).toBe(customerOf(seeded).name);
        expect(row.overdue).toBe(seeded.status === 'pending');
      }
    });

    it('fetchCardData, all time: every invoice, and every customer', async () => {
      const cards = await data.fetchCardData('all');
      expect(cards.collected).toEqual({ value: sum(paid), change: null });
      expect(cards.pending).toEqual({ value: sum(pending), change: null });
      expect(cards.invoices).toEqual({ value: invoices.length, change: null });
      expect(cards.customers).toEqual({ value: customers.length, change: null });
    });

    it('fetchCardData, last 12 months: from the month 11 back, compared with the 12 before', async () => {
      // As if it were mid-December 2023: 2023 is the period, 2022 the one before.
      const cards = await data.fetchCardData('12m', new Date('2023-12-15T12:00:00Z'));
      const in2023 = invoices.filter((invoice) => invoice.date.startsWith('2023'));
      const in2022 = invoices.filter((invoice) => invoice.date.startsWith('2022'));
      const paidIn = (rows: typeof invoices) => sum(rows.filter((r) => r.status === 'paid'));
      const customersIn = (rows: typeof invoices) => new Set(rows.map((r) => r.customer_id)).size;
      expect(cards.collected).toEqual({
        value: paidIn(in2023),
        change: percentChange(paidIn(in2023), paidIn(in2022)),
      });
      expect(cards.invoices).toEqual({
        value: in2023.length,
        change: percentChange(in2023.length, in2022.length),
      });
      expect(cards.customers.value).toBe(customersIn(in2023));
    });

    it('fetchMonthlyTotals: twelve months for 12m (empty ones as zero), months with invoices for all', async () => {
      const months = await data.fetchMonthlyTotals('12m', new Date('2023-12-15T12:00:00Z'));
      expect(months.map((m) => m.month)).toEqual(
        Array.from({ length: 12 }, (_, i) => `2023-${String(i + 1).padStart(2, '0')}`)
      );
      const june = invoices.filter((invoice) => invoice.date.startsWith('2023-06'));
      expect(months.find((m) => m.month === '2023-06')).toEqual({
        month: '2023-06',
        paid: sum(june.filter((r) => r.status === 'paid')),
        pending: sum(june.filter((r) => r.status === 'pending')),
      });
      expect(months.find((m) => m.month === '2023-01')).toEqual({
        month: '2023-01',
        paid: 0,
        pending: 0,
      });

      const all = await data.fetchMonthlyTotals('all');
      expect(all.map((m) => m.month)).toEqual(
        [...new Set(invoices.map((invoice) => invoice.date.slice(0, 7)))].sort()
      );
    });

    it('fetchFilteredInvoices and fetchInvoicesPages: six a page, newest first', async () => {
      const first = await data.fetchFilteredInvoices('', 1);
      expect(first.map((row) => day(row.date))).toEqual(
        newestFirst.slice(0, 6).map((invoice) => invoice.date)
      );
      const last = await data.fetchFilteredInvoices('', 3);
      expect(last).toHaveLength(invoices.length - 12);
      expect(await data.fetchInvoicesPages('')).toBe(Math.ceil(invoices.length / 6));
    });

    it('fetchFilteredInvoices: the search matches name, email, amount, date and status, any case', async () => {
      const balazs = customers.find((customer) => customer.name === 'Balazs Orban')!;
      const his = invoices.filter((invoice) => invoice.customer_id === balazs.id);
      for (const query of ['balazs orban', 'BALAZS@ORBAN.COM']) {
        const rows = await data.fetchFilteredInvoices(query, 1);
        expect(rows.map((row) => row.name)).toEqual(his.map(() => 'Balazs Orban'));
      }
      expect((await data.fetchFilteredInvoices('44800', 1)).map((row) => row.amount)).toEqual([
        44800,
      ]);
      expect(
        (await data.fetchFilteredInvoices('2022-11-14', 1)).map((row) => day(row.date))
      ).toEqual(['2022-11-14']);
      // Eight seeded invoices are paid: a full first page, and two pages.
      expect(await data.fetchFilteredInvoices('PAID', 1)).toHaveLength(Math.min(6, paid.length));
      expect(await data.fetchInvoicesPages('PAID')).toBe(Math.ceil(paid.length / 6));
      expect(await data.fetchFilteredInvoices('no such invoice', 1)).toEqual([]);
      expect(await data.fetchInvoicesPages('no such invoice')).toBe(0);
      // A query is a value, never SQL.
      expect(await data.fetchFilteredInvoices("' OR 1=1 --", 1)).toEqual([]);
    });

    it('the status filter: paid, pending (not yet due) and overdue are disjoint', async () => {
      const ofStatus = async (status: 'paid' | 'pending' | 'overdue') => {
        const rows = [];
        for (let page = 1; page <= (await data.fetchInvoicesPages('', status)); page++) {
          rows.push(...(await data.fetchFilteredInvoices('', page, status)));
        }
        return rows;
      };
      const paidRows = await ofStatus('paid');
      expect(paidRows).toHaveLength(paid.length);
      expect(paidRows.every((row) => row.status === 'paid' && !row.overdue)).toBe(true);
      const overdueRows = await ofStatus('overdue');
      expect(overdueRows).toHaveLength(pending.length);
      expect(overdueRows.every((row) => row.status === 'pending' && row.overdue)).toBe(true);
      expect(await ofStatus('pending')).toEqual([]);
      expect(await data.fetchInvoicesPages('', 'paid')).toBe(Math.ceil(paid.length / 6));

      // Combined with a search, both must match.
      const balazsPaid = await data.fetchFilteredInvoices('Balazs', 1, 'paid');
      expect(balazsPaid.length).toBeGreaterThan(0);
      expect(balazsPaid.every((row) => row.name === 'Balazs Orban' && row.status === 'paid')).toBe(
        true
      );
    });

    it('fetchInvoicesForExport: every match, dates as text, overdue marked', async () => {
      const rows = await data.fetchInvoicesForExport('', null);
      expect(rows.map((row) => row.date)).toEqual(newestFirst.map((invoice) => invoice.date));
      expect(rows.map((row) => row.due_date)).toEqual(
        newestFirst.map((invoice) => invoice.due_date)
      );
      expect(rows.map((row) => row.overdue)).toEqual(
        newestFirst.map((invoice) => invoice.status === 'pending')
      );
      expect(await data.fetchInvoicesForExport('Balazs', 'overdue')).toHaveLength(
        pending.filter((invoice) => customerOf(invoice).name === 'Balazs Orban').length
      );
    });

    it('fetchInvoiceById and fetchInvoiceDetail: one invoice, or nothing', async () => {
      const [row] = await data.fetchFilteredInvoices('44800', 1);
      const form = await data.fetchInvoiceById(row.id);
      const seeded = invoices.find((invoice) => invoice.amount === 44800)!;
      // The edit form takes dollars.
      expect(form).toEqual({
        id: row.id,
        customer_id: seeded.customer_id.toLowerCase(),
        amount: 448,
        status: 'paid',
      });

      const detail = await data.fetchInvoiceDetail(row.id);
      expect(detail).toMatchObject({
        id: row.id,
        amount: 44800,
        status: 'paid',
        overdue: false,
        name: customerOf(seeded).name,
        email: customerOf(seeded).email,
      });
      expect(day(detail!.date)).toBe(seeded.date);
      expect(day(detail!.due_date)).toBe(seeded.due_date);

      const nobody = '00000000-0000-4000-8000-000000000000';
      expect(await data.fetchInvoiceById(nobody)).toBeUndefined();
      expect(await data.fetchInvoiceDetail(nobody)).toBeUndefined();
    });

    it('fetchCustomers and fetchCustomerById', async () => {
      const all = await data.fetchCustomers();
      expect(all.map((customer) => customer.name)).toEqual(
        customers.map((customer) => customer.name).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
      );
      const amy = all.find((customer) => customer.name === 'Amy Burns')!;
      expect(await data.fetchCustomerById(amy.id)).toEqual({
        id: amy.id,
        name: 'Amy Burns',
        email: 'amy@burns.com',
      });
      expect(await data.fetchCustomerById('00000000-0000-4000-8000-000000000000')).toBeUndefined();
    });

    it('fetchFilteredCustomers: each customer with their invoice count and totals', async () => {
      const rows = await data.fetchFilteredCustomers('');
      expect(rows).toHaveLength(customers.length);
      for (const customer of customers) {
        const theirs = invoices.filter((invoice) => invoice.customer_id === customer.id);
        const row = rows.find((r) => r.name === customer.name)!;
        expect(Number(row.total_invoices)).toBe(theirs.length);
        expect(row.total_paid).toBe(formatCurrency(sum(theirs.filter((r) => r.status === 'paid'))));
        expect(row.total_pending).toBe(
          formatCurrency(sum(theirs.filter((r) => r.status === 'pending')))
        );
      }
      expect((await data.fetchFilteredCustomers('ROBINSON')).map((r) => r.name)).toEqual([
        'Lee Robinson',
      ]);
      expect(await data.fetchFilteredCustomers('no such customer')).toEqual([]);
    });
  });

  // Last, since it adds rows: a customer of its own, with one invoice not yet due
  // and one past due, so pending and overdue both have a member.
  describe('with invoices of its own', () => {
    let sql: postgres.Sql;
    const tag = `vitest${Date.now().toString(36)}`;

    beforeAll(async () => {
      sql = postgres(url!, { ssl: 'require', max: 1, onnotice: () => {} });
      const [{ id }] = await sql`
        INSERT INTO customers (name, email, image_url)
        VALUES (${tag}, ${`${tag}@example.com`}, '/customers/amy-burns.png')
        RETURNING id`;
      await sql`
        INSERT INTO invoices (customer_id, amount, status, date, due_date) VALUES
          (${id}, 1111, 'pending', ${today}, ${addDays(today, 30)}),
          (${id}, 2222, 'pending', ${addDays(today, -40)}, ${addDays(today, -10)})`;
    });

    afterAll(async () => {
      await sql`DELETE FROM invoices WHERE customer_id IN (SELECT id FROM customers WHERE name = ${tag})`;
      await sql`DELETE FROM customers WHERE name = ${tag}`;
      await sql.end();
    });

    it('an unpaid invoice is pending until its due date, then overdue', async () => {
      const byStatus = async (status: 'pending' | 'overdue') =>
        (await data.fetchFilteredInvoices(tag, 1, status)).map((row) => row.amount);
      expect(await byStatus('pending')).toEqual([1111]);
      expect(await byStatus('overdue')).toEqual([2222]);
      const all = await data.fetchFilteredInvoices(tag, 1);
      expect(all.map((row) => [row.amount, row.overdue])).toEqual([
        [1111, false],
        [2222, true],
      ]);
      expect((await data.fetchInvoicesForExport(tag, 'pending')).map((r) => r.amount)).toEqual([
        1111,
      ]);
      expect(await data.fetchInvoicesPages(tag, 'overdue')).toBe(1);
    });
  });
});

// The login lockout's statements (app/lib/login-limit.ts) against the same schema,
// which the suite above has just rebuilt; each test on an email of its own.
describe.skipIf(!url)('the login lockout in the database', () => {
  let sql: postgres.Sql;
  let lockout: typeof import('@/app/lib/login-limit');
  const limits = { maxFailures: 3, lockMinutes: 15 };
  const email = (name: string) => `${name}-${Date.now().toString(36)}@example.com`;

  beforeAll(async () => {
    sql = postgres(url!, { ssl: 'require', max: 8, onnotice: () => {} });
    lockout = await import('@/app/lib/login-limit');
  });

  afterAll(async () => {
    await sql.end();
  });

  it('lets exactly N of many simultaneous attempts through, then holds the lock', async () => {
    const key = email('burst');
    const results = await Promise.all(
      Array.from({ length: limits.maxFailures + 5 }, () => lockout.claimAttempt(sql, key, limits))
    );
    expect(results.filter(Boolean)).toHaveLength(limits.maxFailures);
    expect(await lockout.claimAttempt(sql, key, limits)).toBe(false);
    const [row] = await sql`
      SELECT locked_until > now() + interval '14 minutes' AS locked FROM login_failures
      WHERE email = ${key}`;
    expect(row.locked).toBe(true);
  });

  it('a success clears the count and the lock its last attempt set', async () => {
    const key = email('success');
    for (let i = 0; i < limits.maxFailures; i++) {
      expect(await lockout.claimAttempt(sql, key, limits)).toBe(true);
    }
    // The Nth attempt's password was right after all.
    await lockout.clearFailures(sql, key);
    expect(await lockout.claimAttempt(sql, key, limits)).toBe(true);
  });

  it('a lock that has run out starts the count again', async () => {
    const key = email('expired');
    for (let i = 0; i <= limits.maxFailures; i++) await lockout.claimAttempt(sql, key, limits);
    expect(await lockout.claimAttempt(sql, key, limits)).toBe(false);
    await sql`
      UPDATE login_failures SET locked_until = now() - interval '1 second' WHERE email = ${key}`;
    for (let i = 0; i < limits.maxFailures; i++) {
      expect(await lockout.claimAttempt(sql, key, limits)).toBe(true);
    }
    expect(await lockout.claimAttempt(sql, key, limits)).toBe(false);
  });
});

// Migration 0003 on a table that already holds invoices: applied after 0001 and
// 0002 to rows written without a due date. Its own schema, dropped afterwards.
describe.skipIf(!url)('migration 0003 on existing invoices', () => {
  const migrationsUrl = databaseUrl('xenocats_vitest_migrations')!;
  let sql: postgres.Sql;
  const migration = (name: string) =>
    readFileSync(new URL(`../../db/migrations/${name}`, import.meta.url), 'utf8');

  beforeAll(async () => {
    sql = postgres(migrationsUrl, { ssl: 'require', max: 1, onnotice: () => {} });
    await sql`DROP SCHEMA IF EXISTS xenocats_vitest_migrations CASCADE`;
    await sql`CREATE SCHEMA xenocats_vitest_migrations`;
  });

  afterAll(async () => {
    await sql`DROP SCHEMA IF EXISTS xenocats_vitest_migrations CASCADE`;
    await sql.end();
  });

  it('gives each existing invoice its date + 30, then requires a due date not before it', async () => {
    // Repository files, not input: unsafe() runs a multi-statement script.
    await sql.unsafe(migration('0001_init.sql'));
    await sql.unsafe(migration('0002_invoice_keys_and_indexes.sql'));
    const [{ id }] = await sql`
      INSERT INTO customers (name, email, image_url) VALUES ('Old', 'old@example.com', '/x.png')
      RETURNING id`;
    await sql`
      INSERT INTO invoices (customer_id, amount, status, date) VALUES
        (${id}, 100, 'paid', '2023-01-31'), (${id}, 200, 'pending', '2024-02-15')`;

    await sql.unsafe(migration('0003_invoice_due_dates.sql'));

    const rows = await sql`
      SELECT to_char(date, 'YYYY-MM-DD') AS date, to_char(due_date, 'YYYY-MM-DD') AS due
      FROM invoices ORDER BY date`;
    expect(rows.map((row) => [row.date, row.due])).toEqual([
      ['2023-01-31', '2023-03-02'],
      ['2024-02-15', '2024-03-16'],
    ]);

    // The app before the migration names no due date: today + 30.
    const [inserted] = await sql`
      INSERT INTO invoices (customer_id, amount, status, date)
      VALUES (${id}, 300, 'pending', CURRENT_DATE)
      RETURNING (due_date - date) AS days`;
    expect(inserted.days).toBe(30);

    await expect(
      sql`INSERT INTO invoices (customer_id, amount, status, date, due_date)
          VALUES (${id}, 400, 'pending', '2024-01-10', '2024-01-09')`
    ).rejects.toThrow(/invoices_due_date_check/);
  });
});
