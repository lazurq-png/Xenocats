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
});

export const CreateInvoice = FormSchema.omit({ id: true, date: true });

export const UpdateInvoice = FormSchema.omit({ id: true, date: true });

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
