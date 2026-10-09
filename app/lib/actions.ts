'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import bcryptjs from 'bcryptjs';
import postgres from 'postgres';
import { auth, signIn } from '@/auth';
import { AuthError, type CredentialsSignin } from 'next-auth';
import { BCRYPT_COST } from '@/app/lib/password-check';
import { LOCKED, claimAttempt, clearFailures, loginKey, loginLimits } from '@/app/lib/login-limit';
import {
  ChangePasswordForm,
  CreateInvoice,
  CustomerForm,
  CustomerId,
  InvoiceId,
  UpdateInvoice,
  dueDateProblem,
} from '@/app/lib/schemas';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

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

/** The database's own check on the due date (db/migrations/0003) refused it. */
const isDueDateRefused = (error: unknown) =>
  (error as { constraint_name?: string })?.constraint_name === 'invoices_due_date_check';

export async function createInvoice(prevState: State, formData: FormData) {
  const owner = await signedInUser();
  if (!owner) {
    return { message: 'You must be logged in to create an invoice.' };
  }

  // Validate form using Zod
  const validatedFields = CreateInvoice.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
    dueDate: formData.get('dueDate'),
  });

  // If form validation fails, return errors early. Otherwise, continue.
  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to Create Invoice.',
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
    return { errors: { dueDate: [problem] }, message: 'Failed to Create Invoice.' };
  }
  const noCustomer: State = {
    errors: { customerId: [NO_CUSTOMER] },
    message: 'Failed to Create Invoice.',
  };
  if (!CustomerId.safeParse(customerId).success) return noCustomer;

  // Insert data into the database: only for one of the user's own customers.
  try {
    const inserted = await sql`
      INSERT INTO invoices (customer_id, amount, status, date, due_date)
      SELECT id, ${amountInCents}::int, ${status}, ${date}::date, ${dueDate}::date
      FROM customers
      WHERE id = ${customerId} AND owner_id = ${owner}
    `;
    if (inserted.count === 0) return noCustomer;
  } catch (error) {
    if (isDueDateRefused(error)) {
      return {
        errors: { dueDate: ['The due date cannot be before the invoice date.'] },
        message: 'Failed to Create Invoice.',
      };
    }
    // Log the database error on the server; return only a generic message.
    console.error('Database Error:', error);
    return {
      message: 'Database Error: Failed to Create Invoice.',
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

  const validatedFields = UpdateInvoice.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
    dueDate: formData.get('dueDate'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to Update Invoice.',
    };
  }

  const { customerId, amount, status, dueDate } = validatedFields.data;
  // Rounded: amount * 100 is not always a whole number in floating point (10000.37
  // gives 1000037.0000000001), and the column is an integer.
  const amountInCents = Math.round(amount * 100);
  const noCustomer: State = {
    errors: { customerId: [NO_CUSTOMER] },
    message: 'Failed to Update Invoice.',
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
      return { errors: { dueDate: [problem] }, message: 'Failed to Update Invoice.' };
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
        message: 'Failed to Update Invoice.',
      };
    }
    console.error('Database Error:', error);
    return { message: 'Database Error: Failed to Update Invoice.' };
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

// Every customer gets the same stored image: avatars are drawn from the name
// (app/ui/customer-avatar.tsx), and the column cannot be empty.
const CUSTOMER_IMAGE = '/xenocats/avatar-1.webp';

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
    await sql`
      INSERT INTO customers (name, email, image_url, owner_id)
      VALUES (${name}, ${email}, ${CUSTOMER_IMAGE}, ${owner})
    `;
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
            return 'Too many failed logins for this email. Try again later.';
          }
          return 'Invalid credentials.';
        default:
          return 'Something went wrong.';
      }
    }
    throw error;
  }
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
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return { message: 'You must be logged in to change your password.' };

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
  const key = `change-password:${loginKey(email)}`;
  try {
    if (!(await claimAttempt(sql, key, loginLimits()))) {
      return { message: 'Too many failed attempts for this account. Try again later.' };
    }
    const [user] = await sql<{ id: string; password: string }[]>`
      SELECT id, password FROM users WHERE email = ${email}`;
    if (!user || !(await bcryptjs.compare(currentPassword, user.password))) {
      return {
        errors: { currentPassword: ['That is not your current password.'] },
        message: 'Your password was not changed.',
      };
    }
    await clearFailures(sql, key);
    const hash = await bcryptjs.hash(newPassword, BCRYPT_COST);
    await sql`UPDATE users SET password = ${hash} WHERE id = ${user.id}`;
  } catch (error) {
    console.error('Database Error:', error);
    return { message: 'Database Error: Failed to change the password.' };
  }
  return { done: true, message: 'Your password has been changed.' };
}
