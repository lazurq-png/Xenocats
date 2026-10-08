// This file contains type definitions for your data.
// It describes the shape of the data, and what data type each property should accept.
// For simplicity of teaching, we're manually defining these types.
// However, these types are generated automatically if you're using an ORM such as Prisma.
export type User = {
  id: string;
  name: string;
  email: string;
  password: string;
};

export type Customer = {
  id: string;
  name: string;
  email: string;
  image_url: string;
};

export type Invoice = {
  id: string;
  customer_id: string;
  amount: number;
  date: string;
  // In TypeScript, this is called a string union type.
  // It means that the "status" property can only be one of the two strings: 'pending' or 'paid'.
  status: 'pending' | 'paid';
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
  image_url: string;
  email: string;
  amount: string;
  date: string;
  status: 'pending' | 'paid';
  /** Pending and past its due date. */
  overdue: boolean;
};

// The database returns a number for amount, but we later format it to a string with the formatCurrency function
export type LatestInvoiceRaw = Omit<LatestInvoice, 'amount'> & {
  amount: number;
};

export type InvoicesTable = {
  id: string;
  customer_id: string;
  name: string;
  email: string;
  image_url: string;
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
  image_url: string;
  total_invoices: number;
  total_pending: number;
  total_paid: number;
};

export type FormattedCustomersTable = {
  id: string;
  name: string;
  email: string;
  image_url: string;
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
  customer_id: string;
  name: string;
  email: string;
};
