'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import postgres from 'postgres';
import { auth, signIn } from '@/auth';
import { AuthError } from 'next-auth';
import { CreateInvoice, CustomerForm, CustomerId, UpdateInvoice } from '@/app/lib/schemas';

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
  const amountInCents = amount * 100;
  const date = new Date().toISOString().split('T')[0];

  // Insert data into the database
  try {
    await sql`
      INSERT INTO invoices (customer_id, amount, status, date)
      VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
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
  const amountInCents = amount * 100;

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

  try {
    await sql`DELETE FROM invoices WHERE id = ${id}`;
  } catch (error) {
    // Log the database error on the server; send the client only a generic message.
    console.error('Database Error:', error);
    throw new Error('Database Error: Failed to Delete Invoice.');
  }

  revalidatePath('/dashboard/invoices');
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

  try {
    await sql`DELETE FROM customers WHERE id = ${id}`;
  } catch (error) {
    if (hasInvoices(error)) {
      return {
        message: 'This customer still has invoices. Delete or reassign them first.',
      };
    }
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
          return 'Invalid credentials.';
        default:
          return 'Something went wrong.';
      }
    }
    throw error;
  }
}
