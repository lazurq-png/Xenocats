import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { percentChange } from '@/app/lib/dashboard';
import { customers, invoices, users } from '@/app/lib/placeholder-data';
import { formatCurrency } from '@/app/lib/utils';

// Every query in app/lib/data.ts (and the login lockout's statements) against a
// real database: its own schema,
// `xenocats_vitest`, on the server POSTGRES_URL names (the environment's, else
// .env's), rebuilt from db/migrations and the seed before this file runs. The
// browser tests use `xenocats_test`, so the two suites never meet.
// Opt-in: they run only with DATABASE_TESTS=1 (CI's "Database tests" step sets
// it), so a plain `npm test` never touches a database. Even then they skip
// without a URL, or with E2E_NO_DATABASE=1 (the server is unreachable).
// The expected values are worked out from the seed (placeholder-data.ts).

function databaseUrl(schema: string): string | null {
  if (process.env.DATABASE_TESTS !== '1' || process.env.E2E_NO_DATABASE) return null;
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

// The actions (app/lib/actions.ts) run against the same schema, with the session
// and the Next.js runtime helpers they call replaced by fakes.
const { auth } = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock('@/auth', () => ({ auth, signIn: vi.fn() }));
vi.mock('next-auth', () => ({ AuthError: class AuthError extends Error {} }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

/** The demo user, who owns every seeded customer (migration 0005, scripts/db.mjs). */
const owner = users[0].id;

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

// The schema is rebuilt once for the whole file, so any block below also runs on
// its own (e.g. with -t).
beforeAll(() => {
  if (!url) return;
  execFileSync(
    process.execPath,
    ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', 'scripts/db.mjs', 'reset'],
    { env: { ...process.env, POSTGRES_URL: url }, stdio: 'pipe' }
  );
}, 60_000);

describe.skipIf(!url)('the queries in app/lib/data.ts', () => {
  let data: typeof import('@/app/lib/data');

  beforeAll(async () => {
    // data.ts connects to POSTGRES_URL when it is first imported.
    process.env.POSTGRES_URL = url!;
    data = await import('@/app/lib/data');
  }, 60_000);

  describe('on the seed alone', () => {
    it('fetchLatestInvoices: the five newest, formatted, overdue when unpaid and past due', async () => {
      const latest = await data.fetchLatestInvoices(owner);
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
      const cards = await data.fetchCardData(owner, 'all');
      expect(cards.collected).toEqual({ value: sum(paid), change: null });
      expect(cards.pending).toEqual({ value: sum(pending), change: null });
      expect(cards.invoices).toEqual({ value: invoices.length, change: null });
      expect(cards.customers).toEqual({ value: customers.length, change: null });
    });

    it('fetchCardData, last 12 months: from the month 11 back, compared with the 12 before', async () => {
      // As if it were mid-December 2023: 2023 is the period, 2022 the one before.
      const cards = await data.fetchCardData(owner, '12m', new Date('2023-12-15T12:00:00Z'));
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
      const months = await data.fetchMonthlyTotals(owner, '12m', new Date('2023-12-15T12:00:00Z'));
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

      const all = await data.fetchMonthlyTotals(owner, 'all');
      expect(all.map((m) => m.month)).toEqual(
        [...new Set(invoices.map((invoice) => invoice.date.slice(0, 7)))].sort()
      );
    });

    it('fetchFilteredInvoices and fetchInvoicesPages: six a page, newest first', async () => {
      const first = await data.fetchFilteredInvoices(owner, '', 1);
      expect(first.map((row) => day(row.date))).toEqual(
        newestFirst.slice(0, 6).map((invoice) => invoice.date)
      );
      const last = await data.fetchFilteredInvoices(owner, '', 3);
      expect(last).toHaveLength(invoices.length - 12);
      expect(await data.fetchInvoicesPages(owner, '')).toBe(Math.ceil(invoices.length / 6));
    });

    it('fetchFilteredInvoices: the search matches name, email, amount, date and status, any case', async () => {
      const balazs = customers.find((customer) => customer.name === 'Balazs Orban')!;
      const his = invoices.filter((invoice) => invoice.customer_id === balazs.id);
      for (const query of ['balazs orban', 'BALAZS@ORBAN.COM']) {
        const rows = await data.fetchFilteredInvoices(owner, query, 1);
        expect(rows.map((row) => row.name)).toEqual(his.map(() => 'Balazs Orban'));
      }
      expect(
        (await data.fetchFilteredInvoices(owner, '44800', 1)).map((row) => row.amount)
      ).toEqual([44800]);
      // Each row carries its due date (the list shows it).
      const [due] = await data.fetchFilteredInvoices(owner, '44800', 1);
      expect(day(due.due_date)).toBe(
        invoices.find((invoice) => invoice.amount === 44800)!.due_date
      );
      expect(
        (await data.fetchFilteredInvoices(owner, '2022-11-14', 1)).map((row) => day(row.date))
      ).toEqual(['2022-11-14']);
      // Eight seeded invoices are paid: a full first page, and two pages.
      expect(await data.fetchFilteredInvoices(owner, 'PAID', 1)).toHaveLength(
        Math.min(6, paid.length)
      );
      expect(await data.fetchInvoicesPages(owner, 'PAID')).toBe(Math.ceil(paid.length / 6));
      expect(await data.fetchFilteredInvoices(owner, 'no such invoice', 1)).toEqual([]);
      expect(await data.fetchInvoicesPages(owner, 'no such invoice')).toBe(0);
      // A query is a value, never SQL.
      expect(await data.fetchFilteredInvoices(owner, "' OR 1=1 --", 1)).toEqual([]);
    });

    it('the status filter: paid, pending (not yet due) and overdue are disjoint', async () => {
      const ofStatus = async (status: 'paid' | 'pending' | 'overdue') => {
        const rows = [];
        for (let page = 1; page <= (await data.fetchInvoicesPages(owner, '', status)); page++) {
          rows.push(...(await data.fetchFilteredInvoices(owner, '', page, status)));
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
      expect(await data.fetchInvoicesPages(owner, '', 'paid')).toBe(Math.ceil(paid.length / 6));

      // Combined with a search, both must match.
      const balazsPaid = await data.fetchFilteredInvoices(owner, 'Balazs', 1, 'paid');
      expect(balazsPaid.length).toBeGreaterThan(0);
      expect(balazsPaid.every((row) => row.name === 'Balazs Orban' && row.status === 'paid')).toBe(
        true
      );
    });

    it('fetchInvoicesForExport: every match, dates as text, overdue marked', async () => {
      const rows = await data.fetchInvoicesForExport(owner, '', null);
      expect(rows.map((row) => row.date)).toEqual(newestFirst.map((invoice) => invoice.date));
      expect(rows.map((row) => row.due_date)).toEqual(
        newestFirst.map((invoice) => invoice.due_date)
      );
      expect(rows.map((row) => row.overdue)).toEqual(
        newestFirst.map((invoice) => invoice.status === 'pending')
      );
      expect(await data.fetchInvoicesForExport(owner, 'Balazs', 'overdue')).toHaveLength(
        pending.filter((invoice) => customerOf(invoice).name === 'Balazs Orban').length
      );
    });

    it('fetchInvoiceById and fetchInvoiceDetail: one invoice, or nothing', async () => {
      const [row] = await data.fetchFilteredInvoices(owner, '44800', 1);
      const form = await data.fetchInvoiceById(owner, row.id);
      const seeded = invoices.find((invoice) => invoice.amount === 44800)!;
      // The edit form takes dollars.
      expect(form).toEqual({
        id: row.id,
        customer_id: seeded.customer_id.toLowerCase(),
        amount: 448,
        status: 'paid',
        date: seeded.date,
        due_date: seeded.due_date,
      });

      const detail = await data.fetchInvoiceDetail(owner, row.id);
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
      // Whole days until it was due: long past (a 2023 invoice), counted by the database.
      expect(Number.isInteger(detail!.days_until_due)).toBe(true);
      expect(detail!.days_until_due).toBeLessThan(-365);

      const nobody = '00000000-0000-4000-8000-000000000000';
      expect(await data.fetchInvoiceById(owner, nobody)).toBeUndefined();
      expect(await data.fetchInvoiceDetail(owner, nobody)).toBeUndefined();
    });

    it('fetchCustomers and fetchCustomerById', async () => {
      const all = await data.fetchCustomers(owner);
      expect(all.map((customer) => customer.name)).toEqual(
        customers.map((customer) => customer.name).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
      );
      const amy = all.find((customer) => customer.name === 'Amy Burns')!;
      expect(await data.fetchCustomerById(owner, amy.id)).toEqual({
        id: amy.id,
        name: 'Amy Burns',
        email: 'amy@burns.com',
      });
      expect(
        await data.fetchCustomerById(owner, '00000000-0000-4000-8000-000000000000')
      ).toBeUndefined();
    });

    it('fetchFilteredCustomers: each customer with their invoice count and totals', async () => {
      const rows = await data.fetchFilteredCustomers(owner, '');
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
      expect((await data.fetchFilteredCustomers(owner, 'ROBINSON')).map((r) => r.name)).toEqual([
        'Lee Robinson',
      ]);
      expect(await data.fetchFilteredCustomers(owner, 'no such customer')).toEqual([]);
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
        INSERT INTO customers (name, email, image_url, owner_id)
        VALUES (${tag}, ${`${tag}@example.com`}, '/customers/amy-burns.png', ${owner})
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
        (await data.fetchFilteredInvoices(owner, tag, 1, status)).map((row) => row.amount);
      expect(await byStatus('pending')).toEqual([1111]);
      expect(await byStatus('overdue')).toEqual([2222]);
      const all = await data.fetchFilteredInvoices(owner, tag, 1);
      expect(all.map((row) => [row.amount, row.overdue])).toEqual([
        [1111, false],
        [2222, true],
      ]);
      expect(
        (await data.fetchInvoicesForExport(owner, tag, 'pending')).map((r) => r.amount)
      ).toEqual([1111]);
      expect(await data.fetchInvoicesPages(owner, tag, 'overdue')).toBe(1);
    });

    it('new invoices show in the revenue chart and the cards, computed from the invoices', async () => {
      // The seed is all from 2022–2023: in the last 12 months only these two count.
      const months = await data.fetchMonthlyTotals(owner, '12m');
      const month = (date: string) => months.find((m) => m.month === date.slice(0, 7))!;
      expect(month(today)).toEqual({ month: today.slice(0, 7), paid: 0, pending: 1111 });
      expect(month(addDays(today, -40)).pending).toBe(2222);
      expect(months.reduce((total, m) => total + m.paid + m.pending, 0)).toBe(3333);

      const cards = await data.fetchCardData(owner, '12m');
      expect(cards.pending.value).toBe(3333);
      expect(cards.invoices.value).toBe(2);
    });
  });
});

// Two accounts on the same schema (migration 0005): a second user with a customer
// and an invoice of its own. Neither ever sees the other's rows, and the actions
// in app/lib/actions.ts, run as one, refuse the other's and change nothing. Its
// own rows, tagged, removed afterwards.
describe.skipIf(!url)('two accounts', () => {
  let sql: postgres.Sql;
  let data: typeof import('@/app/lib/data');
  let actions: typeof import('@/app/lib/actions');
  const tag = `other${Date.now().toString(36)}`;
  let other: string;
  let otherCustomer: string;
  let otherInvoice: string;
  let demoCustomer: string;
  let demoInvoice: string;
  const as = (id: string) => auth.mockResolvedValue({ user: { id, email: `${id}@example.com` } });
  const invoiceForm = (customerId: string, amount = '1.00') => {
    const form = new FormData();
    form.set('customerId', customerId);
    form.set('amount', amount);
    form.set('status', 'pending');
    form.set('dueDate', addDays(today, 30));
    return form;
  };
  const invoiceRow = async (id: string) =>
    (await sql`SELECT customer_id, amount, status FROM invoices WHERE id = ${id}`)[0];
  const customerRow = async (id: string) =>
    (await sql`SELECT name, email, owner_id FROM customers WHERE id = ${id}`)[0];

  beforeAll(async () => {
    sql = postgres(url!, { ssl: 'require', max: 1, onnotice: () => {} });
    process.env.POSTGRES_URL = url!;
    data = await import('@/app/lib/data');
    actions = await import('@/app/lib/actions');
    [{ id: other }] = await sql`
      INSERT INTO users (name, email, password)
      VALUES (${tag}, ${`${tag}@example.com`}, 'not a hash: nobody logs in as this user')
      RETURNING id`;
    [{ id: otherCustomer }] = await sql`
      INSERT INTO customers (name, email, image_url, owner_id)
      VALUES (${tag}, ${`${tag}@example.com`}, '/x.png', ${other})
      RETURNING id`;
    [{ id: otherInvoice }] = await sql`
      INSERT INTO invoices (customer_id, amount, status, date, due_date)
      VALUES (${otherCustomer}, 4242, 'paid', ${today}, ${addDays(today, 30)})
      RETURNING id`;
    [{ id: demoInvoice, customer_id: demoCustomer }] = await sql`
      SELECT invoices.id, invoices.customer_id FROM invoices
      JOIN customers ON invoices.customer_id = customers.id
      WHERE customers.owner_id = ${owner}
      LIMIT 1`;
  }, 60_000);

  afterAll(async () => {
    await sql`DELETE FROM invoices WHERE customer_id IN (SELECT id FROM customers WHERE owner_id = ${other})`;
    await sql`DELETE FROM customers WHERE owner_id = ${other}`;
    await sql`DELETE FROM users WHERE id = ${other}`;
    await sql.end();
  });

  it("the demo user's reads, counts, totals, search and export hold none of the other's rows", async () => {
    const names = (rows: { name: string }[]) => rows.map((row) => row.name);
    expect(names(await data.fetchLatestInvoices(owner))).not.toContain(tag);
    expect(names(await data.fetchFilteredInvoices(owner, tag, 1))).toEqual([]);
    expect(await data.fetchInvoicesPages(owner, tag)).toBe(0);
    expect(await data.fetchInvoicesForExport(owner, tag)).toEqual([]);
    expect(names(await data.fetchInvoicesForExport(owner, ''))).not.toContain(tag);
    expect(names(await data.fetchCustomers(owner))).not.toContain(tag);
    expect(await data.fetchFilteredCustomers(owner, tag)).toEqual([]);
    expect(await data.fetchInvoiceById(owner, otherInvoice)).toBeUndefined();
    expect(await data.fetchInvoiceDetail(owner, otherInvoice)).toBeUndefined();
    expect(await data.fetchCustomerById(owner, otherCustomer)).toBeUndefined();
    // Totals: the seed's alone (the block above removed its own rows), though the
    // other's paid invoice is dated today.
    expect(await data.fetchCardData(owner, 'all')).toEqual({
      collected: { value: sum(paid), change: null },
      pending: { value: sum(pending), change: null },
      invoices: { value: invoices.length, change: null },
      customers: { value: customers.length, change: null },
    });
    const months = await data.fetchMonthlyTotals(owner, '12m');
    expect(months.find((m) => m.month === today.slice(0, 7))).toEqual({
      month: today.slice(0, 7),
      paid: 0,
      pending: 0,
    });
  });

  it("the other user's reads hold only its own", async () => {
    expect((await data.fetchLatestInvoices(other)).map((row) => row.amount)).toEqual([
      formatCurrency(4242),
    ]);
    expect((await data.fetchFilteredInvoices(other, '', 1)).map((row) => row.id)).toEqual([
      otherInvoice,
    ]);
    expect(await data.fetchInvoicesPages(other, '')).toBe(1);
    expect((await data.fetchInvoicesForExport(other, '')).map((row) => row.name)).toEqual([tag]);
    expect(await data.fetchCustomers(other)).toEqual([{ id: otherCustomer, name: tag }]);
    expect((await data.fetchFilteredCustomers(other, '')).map((row) => row.name)).toEqual([tag]);
    expect(await data.fetchInvoiceById(other, demoInvoice)).toBeUndefined();
    expect(await data.fetchInvoiceDetail(other, demoInvoice)).toBeUndefined();
    expect(await data.fetchCustomerById(other, demoCustomer)).toBeUndefined();
    expect(await data.fetchCardData(other, 'all')).toEqual({
      collected: { value: 4242, change: null },
      pending: { value: 0, change: null },
      invoices: { value: 1, change: null },
      customers: { value: 1, change: null },
    });
    const months = await data.fetchMonthlyTotals(other, 'all');
    expect(months).toEqual([{ month: today.slice(0, 7), paid: 4242, pending: 0 }]);
  });

  it("the actions refuse the other account's invoices and customers, and change nothing", async () => {
    as(other);
    const invoiceBefore = await invoiceRow(demoInvoice);
    const customerBefore = await customerRow(demoCustomer);
    const invoicesBefore = (await sql`SELECT COUNT(*) FROM invoices`)[0].count;

    // An invoice for the demo user's customer: refused like an unknown customer.
    expect(await actions.createInvoice({}, invoiceForm(demoCustomer))).toEqual({
      errors: { customerId: ['That customer does not exist.'] },
      message: 'Failed to Create Invoice.',
    });
    expect(
      await actions.createInvoice({}, invoiceForm('00000000-0000-4000-8000-000000000000'))
    ).toEqual({
      errors: { customerId: ['That customer does not exist.'] },
      message: 'Failed to Create Invoice.',
    });
    // The demo user's invoice: as unknown as one that does not exist.
    expect(await actions.updateInvoice(demoInvoice, {}, invoiceForm(otherCustomer))).toEqual({
      message: 'No such invoice.',
    });
    expect(
      await actions.updateInvoice(
        '00000000-0000-4000-8000-000000000000',
        {},
        invoiceForm(otherCustomer)
      )
    ).toEqual({ message: 'No such invoice.' });
    // Its own invoice, moved to the demo user's customer: refused.
    expect(await actions.updateInvoice(otherInvoice, {}, invoiceForm(demoCustomer))).toEqual({
      errors: { customerId: ['That customer does not exist.'] },
      message: 'Failed to Update Invoice.',
    });
    await actions.deleteInvoice(demoInvoice);

    const customerForm = new FormData();
    customerForm.set('name', 'Taken over');
    customerForm.set('email', 'taken@example.com');
    expect(await actions.updateCustomer(demoCustomer, {}, customerForm)).toEqual({
      message: 'That customer does not exist.',
    });
    expect(await actions.deleteCustomer(demoCustomer, {})).toEqual({
      message: 'That customer does not exist.',
    });

    expect(await invoiceRow(demoInvoice)).toEqual(invoiceBefore);
    expect(await customerRow(demoCustomer)).toEqual(customerBefore);
    expect(await invoiceRow(otherInvoice)).toMatchObject({ customer_id: otherCustomer });
    expect((await sql`SELECT COUNT(*) FROM invoices`)[0].count).toBe(invoicesBefore);
  });

  it('the actions still work on the user’s own rows, and a new customer is its creator’s', async () => {
    as(other);
    await actions.createInvoice({}, invoiceForm(otherCustomer, '7.77'));
    expect(
      (
        await sql`SELECT amount FROM invoices WHERE customer_id = ${otherCustomer} ORDER BY amount`
      ).map((row) => row.amount)
    ).toEqual([777, 4242]);
    await actions.updateInvoice(otherInvoice, {}, invoiceForm(otherCustomer, '1.23'));
    expect(await invoiceRow(otherInvoice)).toMatchObject({ amount: 123, status: 'pending' });

    const form = new FormData();
    form.set('name', `${tag} second`);
    form.set('email', `${tag}-2@example.com`);
    await actions.createCustomer({}, form);
    const [created] = await sql`SELECT owner_id FROM customers WHERE name = ${`${tag} second`}`;
    expect(created.owner_id).toBe(other);
    expect(await data.fetchFilteredCustomers(owner, `${tag} second`)).toEqual([]);
  });
});

// The login lockout's statements (app/lib/login-limit.ts) against the same schema,
// which the file-level beforeAll rebuilds; each test on an email of its own.
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

// Migrations on tables that already hold rows: 0003 applied after 0001 and 0002
// to invoices written without a due date, and 0005 to customers written without
// an owner. Their own schema, dropped afterwards.
describe.skipIf(!url)('migrations on existing rows', () => {
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

  // Migration 0005 on a schema that already has customers, rebuilt for each case.
  const before0005 = async () => {
    await sql`DROP SCHEMA IF EXISTS xenocats_vitest_migrations CASCADE`;
    await sql`CREATE SCHEMA xenocats_vitest_migrations`;
    for (const name of [
      '0001_init.sql',
      '0002_invoice_keys_and_indexes.sql',
      '0003_invoice_due_dates.sql',
      '0004_login_failures.sql',
    ]) {
      await sql.unsafe(migration(name));
    }
    await sql`
      INSERT INTO customers (name, email, image_url) VALUES
        ('Old A', 'a@example.com', '/x.png'), ('Old B', 'b@example.com', '/x.png')`;
  };
  const addUser = async (email: string) =>
    (
      await sql`INSERT INTO users (name, email, password) VALUES (${email}, ${email}, 'x') RETURNING id`
    )[0].id as string;
  /** Run as scripts/db.mjs runs it: in one transaction. */
  const run0005 = () => sql.begin((tx) => tx.unsafe(migration('0005_customer_owners.sql')));

  it('0005 gives every existing customer to the only user, then requires an owner', async () => {
    await before0005();
    const only = await addUser('only@example.com');
    await run0005();
    expect((await sql`SELECT owner_id FROM customers`).map((row) => row.owner_id)).toEqual([
      only,
      only,
    ]);
    await expect(
      sql`INSERT INTO customers (name, email, image_url) VALUES ('New', 'n@example.com', '/x.png')`
    ).rejects.toThrow(/owner_id/);
    await expect(
      sql`INSERT INTO customers (name, email, image_url, owner_id)
          VALUES ('New', 'n@example.com', '/x.png', '00000000-0000-4000-8000-000000000000')`
    ).rejects.toThrow(/customers_owner_id_fkey/);
    // A user who still owns customers cannot be deleted from under them.
    await expect(sql`DELETE FROM users WHERE id = ${only}`).rejects.toThrow(
      /customers_owner_id_fkey/
    );
  });

  it('0005 stops, changing nothing, when customers exist and not exactly one user; assigned by hand, it runs', async () => {
    await before0005();
    const first = await addUser('first@example.com');
    await addUser('second@example.com');
    await expect(run0005()).rejects.toThrow(/give each customer an owner/);
    const [column] = await sql`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'xenocats_vitest_migrations' AND table_name = 'customers'
        AND column_name = 'owner_id'`;
    expect(column).toBeUndefined();

    // What the migration's comment tells a human to do, then run it again.
    await sql`ALTER TABLE customers ADD COLUMN owner_id UUID`;
    await sql`UPDATE customers SET owner_id = ${first}`;
    await run0005();
    expect((await sql`SELECT DISTINCT owner_id FROM customers`).map((r) => r.owner_id)).toEqual([
      first,
    ]);
    await expect(sql`DELETE FROM users WHERE id = ${first}`).rejects.toThrow(
      /customers_owner_id_fkey/
    );
  });

  it('0005 on an empty database (no customers) needs no user', async () => {
    await sql`DROP SCHEMA IF EXISTS xenocats_vitest_migrations CASCADE`;
    await sql`CREATE SCHEMA xenocats_vitest_migrations`;
    for (const name of [
      '0001_init.sql',
      '0002_invoice_keys_and_indexes.sql',
      '0003_invoice_due_dates.sql',
      '0004_login_failures.sql',
    ]) {
      await sql.unsafe(migration(name));
    }
    await run0005();
    const [column] = await sql`
      SELECT is_nullable FROM information_schema.columns
      WHERE table_schema = 'xenocats_vitest_migrations' AND table_name = 'customers'
        AND column_name = 'owner_id'`;
    expect(column.is_nullable).toBe('NO');
  });
});
