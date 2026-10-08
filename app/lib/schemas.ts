import { z } from 'zod';

// Kept out of actions.ts: a 'use server' module may only export async functions,
// and importing it opens a database connection. Tests import these directly.
export const FormSchema = z.object({
  id: z.string(),
  customerId: z.string({
    invalid_type_error: 'Please select a customer.',
  }),
  amount: z.coerce.number().gt(0, { message: 'Please enter an amount greater than $0' }),
  status: z.enum(['pending', 'paid'], {
    invalid_type_error: 'Please select an invoice status.',
  }),
  date: z.string(),
  /** When it is to be paid: a calendar date, YYYY-MM-DD (checked against its date by the action). */
  dueDate: z
    .string({ invalid_type_error: 'Please choose a due date.' })
    .superRefine((value, context) => {
      // One message: not a date at all, or a date that does not exist.
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        context.addIssue({ code: 'custom', message: 'Please choose a due date.' });
      } else if (!isCalendarDate(value)) {
        context.addIssue({ code: 'custom', message: 'Please choose a real date.' });
      }
    }),
});

export const CreateInvoice = FormSchema.omit({ id: true, date: true });

export const UpdateInvoice = FormSchema.omit({ id: true, date: true });

/** The payment term an invoice is given unless another due date is chosen, days. */
export const PAYMENT_DAYS = 30;
/** A due date can be at most this long after the invoice's date, days. */
export const MAX_PAYMENT_DAYS = 365;

/** Whether `value` (YYYY-MM-DD) is a date that exists: not 2026-02-30. */
function isCalendarDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** `date` (YYYY-MM-DD) moved by `days`. */
export function addDays(date: string, days: number): string {
  const moved = new Date(`${date}T00:00:00Z`);
  moved.setUTCDate(moved.getUTCDate() + days);
  return moved.toISOString().slice(0, 10);
}

/**
 * What is wrong with a due date for an invoice dated `invoiceDate`, or null: it may
 * not come before the invoice's date (the database's check says the same) nor more
 * than MAX_PAYMENT_DAYS after it. Both are YYYY-MM-DD, so they compare as text.
 */
export function dueDateProblem(dueDate: string, invoiceDate: string): string | null {
  if (dueDate < invoiceDate) return 'The due date cannot be before the invoice date.';
  if (dueDate > addDays(invoiceDate, MAX_PAYMENT_DAYS)) {
    return 'The due date can be at most a year after the invoice date.';
  }
  return null;
}

/** A customer as the create and edit forms send it. */
export const CustomerForm = z.object({
  name: z
    .string({ invalid_type_error: 'Please enter a name.' })
    .trim()
    .min(1, { message: 'Please enter a name.' })
    .max(255, { message: 'A name can be at most 255 characters.' }),
  email: z
    .string({ invalid_type_error: 'Please enter an email address.' })
    .trim()
    .max(255, { message: 'An email address can be at most 255 characters.' })
    .email({ message: 'Please enter a valid email address.' }),
});

/** A customer id from a URL or a form: anything but a UUID names no customer. */
export const CustomerId = z.string().uuid();

/** An invoice id from a URL or an action's argument, likewise. */
export const InvoiceId = z.string().uuid();

/**
 * The invoice list's status filter, from the URL: anything unknown shows every
 * status. Pending means unpaid and not yet due; overdue, unpaid and past due.
 */
export const InvoiceStatusFilter = z.enum(['paid', 'pending', 'overdue']);
export type InvoiceStatusFilter = z.infer<typeof InvoiceStatusFilter>;

export const parseStatusFilter = (value: string | undefined): InvoiceStatusFilter | null =>
  InvoiceStatusFilter.safeParse(value).data ?? null;

const BCRYPT_MAX_BYTES = 72;

/**
 * The change-password form: the current password, and the new one typed twice.
 * At least 8 characters; at most 72 bytes, beyond which bcrypt ignores the rest.
 */
export const ChangePasswordForm = z
  .object({
    currentPassword: z
      .string({ invalid_type_error: 'Please enter your current password.' })
      .min(1, { message: 'Please enter your current password.' }),
    newPassword: z
      .string({ invalid_type_error: 'Please choose a new password.' })
      .min(8, { message: 'A new password needs at least 8 characters.' })
      .refine((password) => new TextEncoder().encode(password).length <= BCRYPT_MAX_BYTES, {
        message: 'A new password can be at most 72 bytes long.',
      }),
    confirmPassword: z.string({ invalid_type_error: 'Please type the new password again.' }),
  })
  .refine((form) => form.newPassword === form.confirmPassword, {
    path: ['confirmPassword'],
    message: 'The two new passwords do not match.',
  })
  .refine((form) => form.newPassword !== form.currentPassword, {
    path: ['newPassword'],
    message: 'The new password must differ from the current one.',
  });
