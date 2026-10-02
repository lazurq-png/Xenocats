'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import bcryptjs from 'bcryptjs';
import postgres from 'postgres';
import { auth, signIn } from '@/auth';
import { AuthError, type CredentialsSignin } from 'next-auth';
import { LOCKED, claimAttempt, clearFailures, loginKey, loginLimits } from '@/app/lib/login-limit';
import {
  ChangePasswordForm,
  CreateInvoice,
  CustomerForm,
  CustomerId,
  InvoiceId,
  UpdateInvoice,
} from '@/app/lib/schemas';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

// Server Actions are public POST endpoints: proxy.ts only gates page navigation,
// so every action that changes data checks the session itself.
async function isSignedIn() {
  const session = await auth();
  return !!session?.user;
}

export type State = {
  errors?: {
    customerId?: string[];
    amount?: string[];
    status?: string[];
  };
  message?: string | null;
};

export async function createInvoice(prevState: State, formData: FormData) {
  if (!(await isSignedIn())) {
    return { message: 'You must be logged in to create an invoice.' };
  }

  // Validate form using Zod
  const validatedFields = CreateInvoice.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });

  // If form validation fails, return errors early. Otherwise, continue.
  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to Create Invoice.',
    };
  }

  // Prepare data for insertion into the database
  const { customerId, amount, status } = validatedFields.data;
  // Rounded: amount * 100 is not always a whole number in floating point (10000.37
  // gives 1000037.0000000001), and the column is an integer.
  const amountInCents = Math.round(amount * 100);
  const date = new Date().toISOString().split('T')[0];
  // Due 30 days after its date: the payment term (db/migrations/0003).

  // Insert data into the database
  try {
    await sql`
      INSERT INTO invoices (customer_id, amount, status, date, due_date)
      VALUES (${customerId}, ${amountInCents}, ${status}, ${date}, ${date}::date + 30)
    `;
  } catch (error) {
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
  if (!(await isSignedIn())) {
    return { message: 'You must be logged in to update an invoice.' };
  }

  const validatedFields = UpdateInvoice.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to Update Invoice.',
    };
  }

  const { customerId, amount, status } = validatedFields.data;
  // Rounded: amount * 100 is not always a whole number in floating point (10000.37
  // gives 1000037.0000000001), and the column is an integer.
  const amountInCents = Math.round(amount * 100);

  try {
    await sql`
      UPDATE invoices
      SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
      WHERE id = ${id}
    `;
  } catch (error) {
    console.error('Database Error:', error);
    return { message: 'Database Error: Failed to Update Invoice.' };
  }

  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

export async function deleteInvoice(id: string) {
  if (!(await isSignedIn())) {
    throw new Error('Unauthorized');
  }
  // The id is the caller's: anything but a UUID names no invoice.
  if (!InvoiceId.safeParse(id).success) {
    throw new Error('No such invoice.');
  }

  try {
    await sql`DELETE FROM invoices WHERE id = ${id}`;
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
  if (!(await isSignedIn())) {
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
      INSERT INTO customers (name, email, image_url)
      VALUES (${name}, ${email}, ${CUSTOMER_IMAGE})
    `;
  } catch (error) {
    console.error('Database Error:', error);
    return { message: 'Database Error: Failed to create the customer.' };
  }

  revalidateCustomers();
  redirect('/dashboard/customers');
}

export async function updateCustomer(id: string, prevState: CustomerState, formData: FormData) {
  if (!(await isSignedIn())) {
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
      UPDATE customers SET name = ${name}, email = ${email} WHERE id = ${id}
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
  if (!(await isSignedIn())) {
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
      WHERE id = ${id} AND NOT EXISTS (SELECT 1 FROM invoices WHERE customer_id = ${id})
    `;
    if (deleted.count === 0) {
      const [exists] = await sql`SELECT 1 FROM customers WHERE id = ${id}`;
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
    const hash = await bcryptjs.hash(newPassword, 10);
    await sql`UPDATE users SET password = ${hash} WHERE id = ${user.id}`;
  } catch (error) {
    console.error('Database Error:', error);
    return { message: 'Database Error: Failed to change the password.' };
  }
  return { done: true, message: 'Your password has been changed.' };
}
