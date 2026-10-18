export type User = {
  id: string;
  name: string;
  /** Null for an account made with a username (migration 0006). */
  email: string | null;
  /** Null for an account made before usernames: it logs in with its email. */
  username: string | null;
  password: string;
  /** Raised when the password changes, which ends every session (migration 0008). */
  session_version: number;
};

/** A dashboard card's value and its change from the previous period (null: nothing to compare). */
export type CardStat = {
  value: number;
  change: number | null;
};

/** Paid and pending invoice totals (cents) for one 'YYYY-MM' month. */
export type MonthTotals = {
  month: string;
  paid: number;
  pending: number;
};

export type LatestInvoice = {
  id: string;
  name: string;
  email: string;
  amount: string;
  date: string;
  status: 'pending' | 'paid';
  /** Pending and past its due date. */
  overdue: boolean;
};

/** As read: the amount in cents, before formatCurrency makes it a string. */
export type LatestInvoiceRaw = Omit<LatestInvoice, 'amount'> & {
  amount: number;
};

export type InvoicesTable = {
  id: string;
  name: string;
  email: string;
  date: string;
  due_date: string;
  amount: number;
  status: 'pending' | 'paid';
  /** Pending and past its due date. */
  overdue: boolean;
};

export type CustomersTableType = {
  id: string;
  name: string;
  email: string;
  total_invoices: number;
  total_pending: number;
  total_paid: number;
};

export type FormattedCustomersTable = {
  id: string;
  name: string;
  email: string;
  total_invoices: number;
  total_pending: string;
  total_paid: string;
};

/** A customer as the edit form shows it. */
export type CustomerEdit = {
  id: string;
  name: string;
  email: string;
};

export type CustomerField = {
  id: string;
  name: string;
};

export type InvoiceForm = {
  id: string;
  customer_id: string;
  amount: number;
  status: 'pending' | 'paid';
  /** YYYY-MM-DD: its date (the due date cannot be before it), and its due date. */
  date: string;
  due_date: string;
};

/** An invoice and its customer, as the detail page shows them. */
export type InvoiceDetail = {
  id: string;
  amount: number;
  status: 'pending' | 'paid';
  date: string;
  due_date: string;
  /** Pending and past its due date. */
  overdue: boolean;
  /** Whole days until its due date (negative once past), by the database's day. */
  days_until_due: number;
  customer_id: string;
  name: string;
  email: string;
};

/** A run on Survival's leaderboard: a player's best of its length, and its place. */
export type LeaderboardRow = {
  /** 0: an endless run. */
  run_minutes: 0 | 5 | 10 | 15;
  place: number;
  /** The viewer's own. */
  mine: boolean;
  name: string;
  time_ms: number;
  sent_home: number;
};
