import { z } from 'zod';

// Kept out of actions.ts: a 'use server' module may only export async functions,
// and importing it opens a database connection. Tests import these directly.

/** The largest amount an invoice can have, dollars (the database checks it too, migration 0007). */
export const MAX_AMOUNT = 1_000_000;

/** An invoice as the create and edit forms send it. */
export const InvoiceFields = z.object({
  customerId: z.string({
    invalid_type_error: 'Please select a customer.',
  }),
  // Stored in whole cents (INT), so at least one cent once rounded, and bounded.
  amount: z.coerce
    .number()
    .gt(0, { message: 'Please enter an amount greater than $0' })
    // (Zero and below have the message above; this is for what rounds to nothing.)
    .refine((amount) => amount <= 0 || Math.round(amount * 100) >= 1, {
      message: 'Please enter an amount of at least $0.01.',
    })
    .refine((amount) => amount <= MAX_AMOUNT, {
      message: 'An amount can be at most $1,000,000.',
    }),
  status: z.enum(['pending', 'paid'], {
    invalid_type_error: 'Please select an invoice status.',
  }),
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
    .max(255, { message: 'A name can be at most 255 characters.' })
    .refine((name) => isPlainText(name), {
      message: 'A name cannot contain invisible or control characters.',
    }),
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

/**
 * The customer list's sort, from the URL (`?sort=`, `?dir=`): one of a fixed list of
 * columns, ascending or descending. Anything else sorts by name, ascending.
 */
export const CustomerSort = z.enum(['name', 'total_invoices', 'total_pending', 'total_paid']);
export type CustomerSort = z.infer<typeof CustomerSort>;
export const SortDirection = z.enum(['asc', 'desc']);
export type SortDirection = z.infer<typeof SortDirection>;

export const parseCustomerSort = (value: unknown): CustomerSort =>
  CustomerSort.safeParse(value).data ?? 'name';
export const parseSortDirection = (value: unknown): SortDirection =>
  SortDirection.safeParse(value).data ?? 'asc';

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

/** A username, as an account is made with one (the database checks the same, migration 0006). */
export const USERNAME_PATTERN = /^[A-Za-z0-9_-]{3,20}$/;

/**
 * The sign-up form: a username and a password typed twice. The password follows the
 * same rules as a changed one: at least 8 characters, at most 72 bytes.
 */
export const SignUpForm = z
  .object({
    username: z
      .string({ invalid_type_error: 'Please choose a username.' })
      .trim()
      .regex(USERNAME_PATTERN, {
        message: 'A username is 3 to 20 letters, digits, "_" or "-".',
      }),
    password: z
      .string({ invalid_type_error: 'Please choose a password.' })
      .min(8, { message: 'A password needs at least 8 characters.' })
      .refine((password) => new TextEncoder().encode(password).length <= BCRYPT_MAX_BYTES, {
        message: 'A password can be at most 72 bytes long.',
      }),
    confirmPassword: z.string({ invalid_type_error: 'Please type the password again.' }),
  })
  .refine((form) => form.password === form.confirmPassword, {
    path: ['confirmPassword'],
    message: 'The two passwords do not match.',
  });

/**
 * Characters nobody can see, or that change how the text around them is shown:
 * control characters, zero-width and direction marks (U+202E writes what follows
 * backwards), line and paragraph separators, private-use and lone surrogates. Text a
 * person types and others read is refused with any of them in it.
 */
const HIDDEN_CHARACTERS = /[\p{Cc}\p{Cf}\p{Co}\p{Cs}\p{Zl}\p{Zp}]/u;

/** Whether `text` has none of the HIDDEN_CHARACTERS. */
export const isPlainText = (text: string) => !HIDDEN_CHARACTERS.test(text);

/** Survival's run lengths, in minutes; 0 is an endless run (arena-storage.ts offers the same). */
export const RunMinutes = z.union([z.literal(0), z.literal(5), z.literal(10), z.literal(15)]);

/** The longest time a Survival run can send, ms: a day (an endless run has no length). */
export const MAX_RUN_MS = 24 * 3_600_000;

/**
 * A name on the public leaderboard: 1 to 20 letters (of any language), digits,
 * spaces and _ . ' -, its spaces trimmed and runs of them made one. Nothing else, so
 * no name can hide characters, look like markup or pass for another by a trick of
 * the text's direction.
 */
export const LeaderboardName = z
  .string({ invalid_type_error: 'Please enter a name.' })
  .transform((name) => name.normalize('NFC').trim().replace(/\s+/g, ' '))
  .pipe(
    z
      .string()
      .min(1, { message: 'Please enter a name.' })
      .max(20, { message: 'A name can be at most 20 characters.' })
      .regex(/^[\p{L}\p{M}\p{N} _.'-]+$/u, {
        message: "A name is letters, digits, spaces and _ . ' - only.",
      })
      // Marks (accents, vowel signs) belong on a letter or digit.
      .refine((name) => !/(^|[^\p{L}\p{N}\p{M}])\p{M}/u.test(name), {
        message: 'An accent must be on a letter.',
      })
      // And at most three that sit on one spot (non-spacing Mn, or enclosing Me) in a row:
      // more stack into a tower over the leaderboard's other rows. Spacing marks (Mc) move
      // the text along, so they are not counted: Burmese ကျော် (Kyaw) has four marks, one Mn.
      .refine((name) => !/[\p{Mn}\p{Me}]{4}/u.test(name), {
        message: 'A letter can carry at most three accents.',
      })
  );

/**
 * A finished Survival run, as the game sends it to the leaderboard: the run the
 * server started for it (startSurvivalRun), the name the player typed, how long it
 * lasted and the cats sent home. Its length is the started run's, never the game's
 * say; the database refuses a time longer than the run has really lasted.
 */
export const SurvivalRun = z.object({
  runId: z.string().uuid(),
  name: LeaderboardName,
  timeMs: z.number().int().min(0).max(MAX_RUN_MS),
  sentHome: z.number().int().min(0).max(1_000_000),
});
export type SurvivalRun = z.input<typeof SurvivalRun>;

/** How long a search can be: anything past it is ignored. */
export const SEARCH_MAX_LENGTH = 100;

/**
 * A search as an ILIKE pattern that finds it anywhere: cut to SEARCH_MAX_LENGTH,
 * with % and _ (and the escape, \) matched as themselves, not as wildcards.
 */
export const containsPattern = (query: unknown) =>
  `%${String(query ?? '')
    .slice(0, SEARCH_MAX_LENGTH)
    .replace(/[\\%_]/g, '\\$&')}%`;

/**
 * The most invoices and customers one account can make. Far past any real use, they
 * stop one signed-in caller filling the database: an action is a public endpoint.
 * 10,000 invoices is also the most one export holds (EXPORT_LIMIT), so exporting all
 * of them always works; a thousand customers is a dropdown the invoice form can show.
 */
export const MAX_INVOICES_PER_ACCOUNT = 10_000;
export const MAX_CUSTOMERS_PER_ACCOUNT = 1_000;
