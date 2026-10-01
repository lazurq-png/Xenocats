import postgres from 'postgres';
import {
  CardStat,
  CustomerField,
  CustomersTableType,
  InvoiceForm,
  InvoicesTable,
  LatestInvoiceRaw,
  MonthTotals,
} from './definitions';
import { formatCurrency } from './utils';
import { Range, lastTwelveMonths, monthStart, percentChange } from './dashboard';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

export async function fetchLatestInvoices() {
  try {
    const data = await sql<LatestInvoiceRaw[]>`
      SELECT invoices.amount, invoices.date, invoices.status, customers.name, customers.image_url, customers.email, invoices.id
      FROM invoices
      JOIN customers ON invoices.customer_id = customers.id
      ORDER BY invoices.date DESC
      LIMIT 5`;

    const latestInvoices = data.map((invoice) => ({
      ...invoice,
      amount: formatCurrency(invoice.amount),
    }));

    return latestInvoices;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch the latest invoices.');
  }
}

/** Paid and pending totals, invoice count and invoiced customers for invoices dated in [from, to). */
async function invoiceTotals(from: string | null, to: string | null) {
  const [row] = await sql<{ paid: string; pending: string; invoices: number; customers: number }[]>`
    SELECT
      COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) AS paid,
      COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) AS pending,
      COUNT(*)::int AS invoices,
      COUNT(DISTINCT customer_id)::int AS customers
    FROM invoices
    WHERE (${from}::date IS NULL OR date >= ${from}::date)
      AND (${to}::date IS NULL OR date < ${to}::date)`;
  return {
    paid: Number(row.paid),
    pending: Number(row.pending),
    invoices: row.invoices,
    customers: row.customers,
  };
}

/**
 * The four summary cards for a range. For the last 12 months each value comes
 * with its change from the 12 months before; all time has nothing to compare with.
 * Customers are those invoiced in the range, or every customer for all time.
 */
export async function fetchCardData(range: Range, now = new Date()) {
  try {
    if (range === 'all') {
      const [totals, [customers]] = await Promise.all([
        invoiceTotals(null, null),
        sql<{ count: string }[]>`SELECT COUNT(*) FROM customers`,
      ]);
      const stat = (value: number): CardStat => ({ value, change: null });
      return {
        collected: stat(totals.paid),
        pending: stat(totals.pending),
        invoices: stat(totals.invoices),
        customers: stat(Number(customers.count)),
      };
    }

    const start = monthStart(now, 11);
    const [current, previous] = await Promise.all([
      invoiceTotals(start, null),
      invoiceTotals(monthStart(now, 23), start),
    ]);
    const stat = (key: keyof typeof current): CardStat => ({
      value: current[key],
      change: percentChange(current[key], previous[key]),
    });
    return {
      collected: stat('paid'),
      pending: stat('pending'),
      invoices: stat('invoices'),
      customers: stat('customers'),
    };
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch card data.');
  }
}

/**
 * Paid and pending invoice totals per month: every one of the last 12 months
 * (empty ones included), or every month that has invoices for all time.
 */
export async function fetchMonthlyTotals(range: Range, now = new Date()): Promise<MonthTotals[]> {
  try {
    const from = range === '12m' ? monthStart(now, 11) : null;
    const rows = await sql<{ month: string; paid: string; pending: string }[]>`
      SELECT
        to_char(date, 'YYYY-MM') AS month,
        SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) AS paid,
        SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) AS pending
      FROM invoices
      WHERE ${from}::date IS NULL OR date >= ${from}::date
      GROUP BY 1
      ORDER BY 1`;
    const byMonth = new Map(
      rows.map((r) => [
        r.month,
        { month: r.month, paid: Number(r.paid), pending: Number(r.pending) },
      ])
    );
    if (range === 'all') return [...byMonth.values()];
    return lastTwelveMonths(now).map(
      (month) => byMonth.get(month) ?? { month, paid: 0, pending: 0 }
    );
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch monthly totals.');
  }
}

const ITEMS_PER_PAGE = 6;
export async function fetchFilteredInvoices(query: string, currentPage: number) {
  const offset = (currentPage - 1) * ITEMS_PER_PAGE;

  try {
    const invoices = await sql<InvoicesTable[]>`
      SELECT
        invoices.id,
        invoices.amount,
        invoices.date,
        invoices.status,
        customers.name,
        customers.email,
        customers.image_url
      FROM invoices
      JOIN customers ON invoices.customer_id = customers.id
      WHERE
        customers.name ILIKE ${`%${query}%`} OR
        customers.email ILIKE ${`%${query}%`} OR
        invoices.amount::text ILIKE ${`%${query}%`} OR
        invoices.date::text ILIKE ${`%${query}%`} OR
        invoices.status ILIKE ${`%${query}%`}
      ORDER BY invoices.date DESC
      LIMIT ${ITEMS_PER_PAGE} OFFSET ${offset}
    `;

    return invoices;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoices.');
  }
}

export async function fetchInvoicesPages(query: string) {
  try {
    const data = await sql`SELECT COUNT(*)
    FROM invoices
    JOIN customers ON invoices.customer_id = customers.id
    WHERE
      customers.name ILIKE ${`%${query}%`} OR
      customers.email ILIKE ${`%${query}%`} OR
      invoices.amount::text ILIKE ${`%${query}%`} OR
      invoices.date::text ILIKE ${`%${query}%`} OR
      invoices.status ILIKE ${`%${query}%`}
  `;

    const totalPages = Math.ceil(Number(data[0].count) / ITEMS_PER_PAGE);
    return totalPages;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch total number of invoices.');
  }
}

export async function fetchInvoiceById(id: string) {
  try {
    const data = await sql<InvoiceForm[]>`
      SELECT
        invoices.id,
        invoices.customer_id,
        invoices.amount,
        invoices.status
      FROM invoices
      WHERE invoices.id = ${id};
    `;

    const invoice = data.map((invoice) => ({
      ...invoice,
      // Convert amount from cents to dollars
      amount: invoice.amount / 100,
    }));

    console.log(invoice);

    return invoice[0];
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoice.');
  }
}

export async function fetchCustomers() {
  try {
    const customers = await sql<CustomerField[]>`
      SELECT
        id,
        name
      FROM customers
      ORDER BY name ASC
    `;

    return customers;
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch all customers.');
  }
}

export async function fetchFilteredCustomers(query: string) {
  try {
    const data = await sql<CustomersTableType[]>`
		SELECT
		  customers.id,
		  customers.name,
		  customers.email,
		  customers.image_url,
		  COUNT(invoices.id) AS total_invoices,
		  SUM(CASE WHEN invoices.status = 'pending' THEN invoices.amount ELSE 0 END) AS total_pending,
		  SUM(CASE WHEN invoices.status = 'paid' THEN invoices.amount ELSE 0 END) AS total_paid
		FROM customers
		LEFT JOIN invoices ON customers.id = invoices.customer_id
		WHERE
		  customers.name ILIKE ${`%${query}%`} OR
        customers.email ILIKE ${`%${query}%`}
		GROUP BY customers.id, customers.name, customers.email, customers.image_url
		ORDER BY customers.name ASC
	  `;

    const customers = data.map((customer) => ({
      ...customer,
      total_pending: formatCurrency(customer.total_pending),
      total_paid: formatCurrency(customer.total_paid),
    }));

    return customers;
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch customer table.');
  }
}
