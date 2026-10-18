'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import bcryptjs from 'bcryptjs';
import type postgres from 'postgres';
import { auth, signIn, signOut } from '@/auth';
import { sql } from '@/app/lib/db';
import { AuthError, type CredentialsSignin } from 'next-auth';
import { BCRYPT_COST } from '@/app/lib/password-check';
import { LOCKED, claimAttempt, clearFailures, loginLimits } from '@/app/lib/login-limit';
import { claimSignUp, clientAddress, clientKey, signUpLimit } from '@/app/lib/sign-up-limit';
import { headers } from 'next/headers';
import {
  ChangePasswordForm,
  CustomerForm,
  CustomerId,
  InvoiceFields,
  InvoiceId,
  MAX_CUSTOMERS_PER_ACCOUNT,
  MAX_INVOICES_PER_ACCOUNT,
  RunMinutes,
  SignUpForm,
  SurvivalRun,
  dueDateProblem,
} from '@/app/lib/schemas';

// Server Actions are public POST endpoints: proxy.ts only gates page navigation,
// so every action that changes data checks the session itself, and changes only
// the signed-in user's own customers and their invoices (migration 0005). Another
// account's are refused exactly as an id that names nothing.
/** The signed-in user's id, from the session; undefined when there is none. */
async function signedInUser() {
  const session = await auth();
  return session?.user?.id;
}

export type State = {
  errors?: {
    customerId?: string[];
    amount?: string[];
    status?: string[];
    dueDate?: string[];
  };
  message?: string | null;
};

/** An invoice's customer that is not one of the user's own: unknown, or another account's. */
const NO_CUSTOMER = 'That customer does not exist.';

/**
 * Holds `owner`'s account until the transaction `tx` ends: another create for the
 * same account waits here, then counts what this one wrote. Without it, creates
 * sent at once would each count the same rows and all fit under the account's limit.
 */
const lockAccount = (tx: postgres.TransactionSql, owner: string) =>
  tx`SELECT pg_advisory_xact_lock(hashtextextended(${`account:${owner}`}, 0))`;

/** The database's own check on the due date (db/migrations/0003) refused it. */
const isDueDateRefused = (error: unknown) =>
  (error as { constraint_name?: string })?.constraint_name === 'invoices_due_date_check';

export async function createInvoice(prevState: State, formData: FormData) {
  const owner = await signedInUser();
  if (!owner) {
    return { message: 'You must be logged in to create an invoice.' };
  }

  // Validate form using Zod
  const validatedFields = InvoiceFields.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
    dueDate: formData.get('dueDate'),
  });

  // If form validation fails, return errors early. Otherwise, continue.
  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing or invalid fields. Failed to create the invoice.',
    };
  }

  // Prepare data for insertion into the database
  const { customerId, amount, status, dueDate } = validatedFields.data;
  // Rounded: amount * 100 is not always a whole number in floating point (10000.37
  // gives 1000037.0000000001), and the column is an integer.
  const amountInCents = Math.round(amount * 100);
  const date = new Date().toISOString().split('T')[0];
  // Due when the form says (30 days after its date unless changed), never before it.
  const problem = dueDateProblem(dueDate, date);
  if (problem) {
    return { errors: { dueDate: [problem] }, message: 'Failed to create the invoice.' };
  }
  const noCustomer: State = {
    errors: { customerId: [NO_CUSTOMER] },
    message: 'Failed to create the invoice.',
  };
  if (!CustomerId.safeParse(customerId).success) return noCustomer;

  // Insert data into the database: only for one of the user's own customers.
  try {
    const refused = await sql.begin(async (tx): Promise<State | null> => {
      await lockAccount(tx, owner);
      const inserted = await tx`
        INSERT INTO invoices (customer_id, amount, status, date, due_date)
        SELECT id, ${amountInCents}::int, ${status}, ${date}::date, ${dueDate}::date
        FROM customers
        WHERE id = ${customerId} AND owner_id = ${owner}
          AND (
            SELECT count(*) FROM invoices
            JOIN customers AS theirs ON invoices.customer_id = theirs.id
            WHERE theirs.owner_id = ${owner}
          ) < ${MAX_INVOICES_PER_ACCOUNT}
      `;
      if (inserted.count === 0) {
        // Not one of the user's customers, or the account is full: which, only now.
        const [held] = await tx<{ n: number }[]>`
          SELECT count(*)::int AS n FROM invoices
          JOIN customers ON invoices.customer_id = customers.id
          WHERE customers.owner_id = ${owner}
        `;
        if ((held?.n ?? 0) >= MAX_INVOICES_PER_ACCOUNT) {
          return {
            message: `An account holds at most ${MAX_INVOICES_PER_ACCOUNT.toLocaleString('en-US')} invoices. Delete some to create more.`,
          };
        }
        return noCustomer;
      }
      return null;
    });
    if (refused) return refused;
  } catch (error) {
    if (isDueDateRefused(error)) {
      return {
        errors: { dueDate: ['The due date cannot be before the invoice date.'] },
        message: 'Failed to create the invoice.',
      };
    }
    // Log the database error on the server; return only a generic message.
    console.error('Database Error:', error);
    return {
      message: 'Database Error: Failed to create the invoice.',
    };
  }

  // Revalidate the cache for the invoices page and redirect the user.
  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

export async function updateInvoice(id: string, prevState: State, formData: FormData) {
  const owner = await signedInUser();
  if (!owner) {
    return { message: 'You must be logged in to update an invoice.' };
  }

  // The id is the caller's: anything but a UUID names no invoice.
  if (!InvoiceId.safeParse(id).success) {
    return { message: 'No such invoice.' };
  }

  const validatedFields = InvoiceFields.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
    dueDate: formData.get('dueDate'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing or invalid fields. Failed to update the invoice.',
    };
  }

  const { customerId, amount, status, dueDate } = validatedFields.data;
  // Rounded: amount * 100 is not always a whole number in floating point (10000.37
  // gives 1000037.0000000001), and the column is an integer.
  const amountInCents = Math.round(amount * 100);
  const noCustomer: State = {
    errors: { customerId: [NO_CUSTOMER] },
    message: 'Failed to update the invoice.',
  };
  if (!CustomerId.safeParse(customerId).success) return noCustomer;

  try {
    // The user's own invoice (through its customer), moved only to one of the
    // user's own customers. The due date is checked against the invoice's own
    // date, which the form does not change.
    const [invoice] = await sql<{ date: string; own_customer: boolean }[]>`
      SELECT
        to_char(invoices.date, 'YYYY-MM-DD') AS date,
        EXISTS (
          SELECT 1 FROM customers AS target
          WHERE target.id = ${customerId} AND target.owner_id = ${owner}
        ) AS own_customer
      FROM invoices
      JOIN customers ON invoices.customer_id = customers.id
      WHERE invoices.id = ${id} AND customers.owner_id = ${owner}
    `;
    if (!invoice) return { message: 'No such invoice.' };
    if (!invoice.own_customer) return noCustomer;
    const problem = dueDateProblem(dueDate, invoice.date);
    if (problem) {
      return { errors: { dueDate: [problem] }, message: 'Failed to update the invoice.' };
    }
    // Both conditions again, so a change between the read and the write cannot
    // slip through.
    const updated = await sql`
      UPDATE invoices
      SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status},
        due_date = ${dueDate}
      WHERE id = ${id}
        AND customer_id IN (SELECT owned.id FROM customers AS owned WHERE owned.owner_id = ${owner})
        AND EXISTS (
          SELECT 1 FROM customers AS target
          WHERE target.id = ${customerId} AND target.owner_id = ${owner}
        )
    `;
    // Deleted between the read and the write: nothing was saved.
    if (updated.count === 0) return { message: 'No such invoice.' };
  } catch (error) {
    if (isDueDateRefused(error)) {
      return {
        errors: { dueDate: ['The due date cannot be before the invoice date.'] },
        message: 'Failed to update the invoice.',
      };
    }
    console.error('Database Error:', error);
    return { message: 'Database Error: Failed to update the invoice.' };
  }

  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

export async function deleteInvoice(id: string) {
  const owner = await signedInUser();
  if (!owner) {
    throw new Error('Unauthorized');
  }
  // The id is the caller's: anything but a UUID names no invoice.
  if (!InvoiceId.safeParse(id).success) {
    throw new Error('No such invoice.');
  }

  try {
    // Only the user's own: another account's invoice, like an unknown one, is
    // left alone without a word.
    await sql`
      DELETE FROM invoices
      WHERE id = ${id}
        AND customer_id IN (SELECT id FROM customers WHERE owner_id = ${owner})
    `;
  } catch (error) {
    // Log the database error on the server; send the client only a generic message.
    console.error('Database Error:', error);
    throw new Error('Database Error: Failed to Delete Invoice.');
  }

  revalidatePath('/dashboard/invoices');
}

/** Deletes from the invoice's own page, then goes to the list (the page is gone). */
export async function deleteInvoiceAndReturn(id: string) {
  await deleteInvoice(id);
  redirect('/dashboard/invoices');
}

export type CustomerState = {
  errors?: {
    name?: string[];
    email?: string[];
  };
  message?: string | null;
};

/** What shows customers: their list, the invoice list (names) and the invoice form. */
function revalidateCustomers() {
  revalidatePath('/dashboard/customers');
  revalidatePath('/dashboard/invoices');
  revalidatePath('/dashboard/invoices/create');
}

export async function createCustomer(prevState: CustomerState, formData: FormData) {
  const owner = await signedInUser();
  if (!owner) {
    return { message: 'You must be logged in to create a customer.' };
  }

  const validatedFields = CustomerForm.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
  });
  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing or invalid fields. Failed to create the customer.',
    };
  }

  const { name, email } = validatedFields.data;
  try {
    const inserted = await sql.begin(async (tx) => {
      await lockAccount(tx, owner);
      return tx`
        INSERT INTO customers (name, email, owner_id)
        SELECT ${name}, ${email}, ${owner}
        WHERE (SELECT count(*) FROM customers WHERE owner_id = ${owner}) < ${MAX_CUSTOMERS_PER_ACCOUNT}
      `;
    });
    if (inserted.count === 0) {
      return {
        message: `An account holds at most ${MAX_CUSTOMERS_PER_ACCOUNT.toLocaleString('en-US')} customers. Delete some to create more.`,
      };
    }
  } catch (error) {
    console.error('Database Error:', error);
    return { message: 'Database Error: Failed to create the customer.' };
  }

  revalidateCustomers();
  redirect('/dashboard/customers');
}

export async function updateCustomer(id: string, prevState: CustomerState, formData: FormData) {
  const owner = await signedInUser();
  if (!owner) {
    return { message: 'You must be logged in to update a customer.' };
  }
  if (!CustomerId.safeParse(id).success) {
    return { message: 'That customer does not exist.' };
  }

  const validatedFields = CustomerForm.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
  });
  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing or invalid fields. Failed to update the customer.',
    };
  }

  const { name, email } = validatedFields.data;
  try {
    const updated = await sql`
      UPDATE customers SET name = ${name}, email = ${email}
      WHERE id = ${id} AND owner_id = ${owner}
    `;
    if (updated.count === 0) return { message: 'That customer does not exist.' };
  } catch (error) {
    console.error('Database Error:', error);
    return { message: 'Database Error: Failed to update the customer.' };
  }

  revalidateCustomers();
  redirect('/dashboard/customers');
}

/** A delete the invoices' foreign key refused (PostgreSQL foreign_key_violation). */
const hasInvoices = (error: unknown) =>
  typeof error === 'object' && error !== null && (error as { code?: unknown }).code === '23503';

export async function deleteCustomer(id: string, prevState: CustomerState): Promise<CustomerState> {
  const owner = await signedInUser();
  if (!owner) {
    return { message: 'You must be logged in to delete a customer.' };
  }
  if (!CustomerId.safeParse(id).success) {
    return { message: 'That customer does not exist.' };
  }

  const stillInvoiced = {
    message: 'This customer still has invoices. Delete or reassign them first.',
  };
  try {
    // Refuses a customer with invoices itself, so it holds even on a database the
    // foreign key (migration 0002) has not reached yet; the key covers the race.
    const deleted = await sql`
      DELETE FROM customers
      WHERE id = ${id} AND owner_id = ${owner}
        AND NOT EXISTS (SELECT 1 FROM invoices WHERE customer_id = ${id})
    `;
    if (deleted.count === 0) {
      const [exists] = await sql`SELECT 1 FROM customers WHERE id = ${id} AND owner_id = ${owner}`;
      return exists ? stillInvoiced : { message: 'That customer does not exist.' };
    }
  } catch (error) {
    if (hasInvoices(error)) return stillInvoiced;
    console.error('Database Error:', error);
    return { message: 'Database Error: Failed to delete the customer.' };
  }

  revalidateCustomers();
  return { message: null };
}

export async function authenticate(prevState: string | undefined, formData: FormData) {
  try {
    await signIn('credentials', formData);
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          if ((error as CredentialsSignin).code === LOCKED) {
            // Not how long: the time left differs from lock to lock.
            return 'Too many failed logins for this account. Try again later.';
          }
          return 'Invalid credentials.';
        default:
          return 'Something went wrong.';
      }
    }
    throw error;
  }
}

export type SignUpState = {
  errors?: {
    username?: string[];
    password?: string[];
    confirmPassword?: string[];
  };
  message?: string | null;
};

/**
 * Makes an account from a username and a password (SignUpForm), stored as a bcrypt
 * hash, then signs it in. It starts with no customers and so no invoices: every
 * account sees only its own (migration 0005).
 */
export async function signUp(prevState: SignUpState, formData: FormData): Promise<SignUpState> {
  const validatedFields = SignUpForm.safeParse({
    username: formData.get('username'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  });
  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Your account was not created.',
    };
  }

  const { username, password } = validatedFields.data;
  try {
    // At most signUpLimit() a day from one address, a taken name counted too, so
    // neither accounts nor taken names can be churned through (sign-up-limit.ts).
    const client = clientKey(clientAddress(await headers()));
    if (!(await claimSignUp(sql, client, signUpLimit()))) {
      return { message: 'Too many accounts were made from here today. Try again tomorrow.' };
    }
    const hash = await bcryptjs.hash(password, BCRYPT_COST);
    // The unique index on lower(username) settles two sign-ups for one name at once.
    const inserted = await sql`
      INSERT INTO users (name, username, password)
      VALUES (${username}, ${username}, ${hash})
      ON CONFLICT DO NOTHING`;
    if (inserted.count === 0) {
      return {
        errors: { username: ['That username is taken.'] },
        message: 'Your account was not created.',
      };
    }
  } catch (error) {
    console.error('Database Error:', error);
    return { message: 'Database Error: Failed to create the account.' };
  }

  // Signed in as the login form does; it redirects (by throwing) to the dashboard.
  try {
    await signIn('credentials', { login: username, password, redirectTo: '/dashboard' });
  } catch (error) {
    if (error instanceof AuthError) {
      return { message: 'Your account was created, but signing in failed. Please log in.' };
    }
    throw error;
  }
  return {};
}

/**
 * Starts a Survival run of `minutes` for the signed-in player, as the game starts
 * one, and gives its id, or null (signed out, a length there is none of, or the
 * database refused). It replaces the player's run in progress, if any: one at a
 * time. The run's length and start are the server's from here on.
 */
export async function startSurvivalRun(minutes: unknown): Promise<string | null> {
  const owner = await signedInUser();
  if (!owner) return null;
  const length = RunMinutes.safeParse(minutes);
  if (!length.success) return null;
  try {
    const [run] = await sql<{ id: string }[]>`
      INSERT INTO survival_runs (user_id, run_minutes)
      VALUES (${owner}, ${length.data})
      ON CONFLICT (user_id) WHERE finished_at IS NULL DO UPDATE SET
        id = gen_random_uuid(), run_minutes = EXCLUDED.run_minutes, started_at = now()
      RETURNING id`;
    return run.id;
  } catch (error) {
    console.error('Database Error:', error);
    return null;
  }
}

/** What became of a run sent to the leaderboard. */
export type SurvivalRunResult = 'saved' | 'signed-out' | 'invalid' | 'error';

/** How far a run's time may run ahead of the server's clock: the start's round trip, ms. */
const START_ALLOWANCE_MS = 2000;
/** More cats than this a second is no run anyone played. */
const MAX_CATS_PER_SECOND = 100;
/** The most runs one player can finish in an hour. */
const MAX_RUNS_PER_HOUR = 60;

/**
 * Finishes a run startSurvivalRun started, under the name the player typed for it:
 * on the leaderboard from now on. Only the signed-in player's own run in progress,
 * once; never with a time longer than its length (an endless run, minutes 0, has
 * none), or than the time since it started
 * (give or take the start's round trip), nor more cats than that time allows; and at
 * most MAX_RUNS_PER_HOUR an hour. Anything else is 'invalid', and changes nothing.
 */
export async function recordSurvivalRun(run: unknown): Promise<SurvivalRunResult> {
  const owner = await signedInUser();
  if (!owner) return 'signed-out';
  const validated = SurvivalRun.safeParse(run);
  if (!validated.success) return 'invalid';
  const { runId, name, timeMs, sentHome } = validated.data;
  try {
    const finished = await sql`
      UPDATE survival_runs SET
        name = ${name}, time_ms = ${timeMs}, sent_home = ${sentHome}, finished_at = now()
      WHERE id = ${runId} AND user_id = ${owner} AND finished_at IS NULL
        AND (run_minutes = 0 OR ${timeMs}::int <= run_minutes * 60000)
        AND ${timeMs}::int <= EXTRACT(EPOCH FROM now() - started_at) * 1000 + ${START_ALLOWANCE_MS}
        AND ${sentHome}::int <= ${timeMs}::int / 1000.0 * ${MAX_CATS_PER_SECOND} + 10
        AND (
          SELECT count(*) FROM survival_runs AS recent
          WHERE recent.user_id = ${owner} AND recent.finished_at > now() - interval '1 hour'
        ) < ${MAX_RUNS_PER_HOUR}`;
    if (finished.count === 0) return 'invalid';
  } catch (error) {
    console.error('Database Error:', error);
    return 'error';
  }
  revalidatePath('/cats');
  return 'saved';
}

export type PasswordState = {
  errors?: {
    currentPassword?: string[];
    newPassword?: string[];
    confirmPassword?: string[];
  };
  message?: string | null;
  /** The password was changed. */
  done?: boolean;
};

/**
 * The logged-in user changes their password: the current one must be right, the
 * new one valid (ChangePasswordForm); it is stored as a bcrypt hash. Checking the
 * current password is a guess at it, so it is limited like a login
 * (app/lib/login-limit.ts), but counted apart: failed logins by someone else
 * cannot stop the user changing their password, nor the reverse.
 */
export async function changePassword(
  prevState: PasswordState,
  formData: FormData
): Promise<PasswordState> {
  // By the session's id: an account made with a username has no email.
  const id = await signedInUser();
  if (!id) return { message: 'You must be logged in to change your password.' };

  const validatedFields = ChangePasswordForm.safeParse({
    currentPassword: formData.get('currentPassword'),
    newPassword: formData.get('newPassword'),
    confirmPassword: formData.get('confirmPassword'),
  });
  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Your password was not changed.',
    };
  }

  const { currentPassword, newPassword } = validatedFields.data;
  const key = `change-password:${id}`;
  try {
    if (!(await claimAttempt(sql, key, loginLimits()))) {
      return { message: 'Too many failed attempts for this account. Try again later.' };
    }
    const [user] = await sql<{ id: string; password: string }[]>`
      SELECT id, password FROM users WHERE id = ${id}`;
    if (!user || !(await bcryptjs.compare(currentPassword, user.password))) {
      return {
        errors: { currentPassword: ['That is not your current password.'] },
        message: 'Your password was not changed.',
      };
    }
    await clearFailures(sql, key);
    const hash = await bcryptjs.hash(newPassword, BCRYPT_COST);
    // A new session version ends every session of the account, wherever it is
    // signed in (auth.config.ts): anyone who knew the old password is out.
    await sql`
      UPDATE users SET password = ${hash}, session_version = session_version + 1
      WHERE id = ${user.id}`;
  } catch (error) {
    console.error('Database Error:', error);
    return { message: 'Database Error: Failed to change the password.' };
  }
  // This session ended with the rest: to the login, to sign in with the new password.
  // (signOut redirects by throwing, so it is outside the try.)
  await signOut({ redirectTo: '/login?password-changed=1' });
  return { done: true, message: 'Your password has been changed.' };
}
