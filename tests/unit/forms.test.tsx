// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The invoice and customer forms, submitted to their real Server Actions: a refused
// form shows each error in the region its field names with aria-describedby, and
// writes nothing. As in actions.test.ts, `postgres`, `@/auth` and the Next.js
// helpers are fakes; the browser tests (tests/e2e/invoices.spec.ts and
// customers.spec.ts) submit valid forms against a real database.
const { sql, auth } = vi.hoisted(() => ({ sql: vi.fn(), auth: vi.fn() }));

vi.mock('postgres', () => ({ default: () => sql }));
vi.mock('@/auth', () => ({ auth, signIn: vi.fn() }));
vi.mock('next-auth', () => ({ AuthError: class AuthError extends Error {} }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

const { default: CreateInvoiceForm } = await import('@/app/ui/invoices/create-form');
const { default: EditInvoiceForm } = await import('@/app/ui/invoices/edit-form');
const { default: CustomerForm } = await import('@/app/ui/customers/customer-form');

const customers = [{ id: 'c0ffee00-0000-4000-8000-000000000001', name: 'Amy Burns' }];

beforeEach(() => {
  vi.clearAllMocks();
  auth.mockResolvedValue({ user: { id: 'u1', name: 'User', email: 'user@example.com' } });
  sql.mockResolvedValue([]);
});
afterEach(() => cleanup());

/** The error region a field names, once the action's answer has rendered in it. */
async function errorFor(label: string, text: string) {
  await screen.findByText(text);
  const field = screen.getByLabelText(label);
  const region = (field.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .map((id) => document.getElementById(id)!)
    .find((element) => element.textContent?.includes(text));
  expect(region, `${label}: ${text}`).toBeTruthy();
  return region!;
}

const submit = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

describe('the invoice create form', () => {
  it('refuses an empty form with an error beside each field, and writes nothing', async () => {
    render(<CreateInvoiceForm customers={customers} dueDate="2026-11-08" />);
    // No customer chosen: the select stays on its disabled "Select a customer", which a
    // browser leaves out of the form, but jsdom sends as "". Disabled, the select sends
    // nothing, as a browser's does.
    (screen.getByLabelText('Choose customer') as HTMLSelectElement).disabled = true;
    submit('Create Invoice');
    await errorFor('Choose customer', 'Please select a customer.');
    await errorFor('Choose an amount', 'Please enter an amount greater than $0');
    await errorFor('Pending', 'Please select an invoice status.');
    expect(sql).not.toHaveBeenCalled();
  });

  it('refuses a zero amount alone: the fields filled in are not errors', async () => {
    render(<CreateInvoiceForm customers={customers} dueDate="2026-11-08" />);
    fireEvent.change(screen.getByLabelText('Choose customer'), {
      target: { value: customers[0].id },
    });
    fireEvent.change(screen.getByLabelText('Choose an amount'), { target: { value: '0' } });
    fireEvent.click(screen.getByLabelText('Paid'));
    submit('Create Invoice');
    await errorFor('Choose an amount', 'Please enter an amount greater than $0');
    expect(document.getElementById('customer-error')!.textContent).toBe('');
    expect(document.getElementById('status-error')!.textContent).toBe('');
    expect(sql).not.toHaveBeenCalled();
  });
});

describe('the invoice edit form', () => {
  it('refuses a negative amount beside the field, and writes nothing', async () => {
    const invoice = {
      id: 'deadbeef-0000-4000-8000-000000000001',
      customer_id: customers[0].id,
      amount: 12.5,
      status: 'pending' as const,
      date: '2026-10-09',
      due_date: '2026-11-08',
    };
    render(<EditInvoiceForm invoice={invoice} customers={customers} />);
    fireEvent.change(screen.getByLabelText('Choose an amount'), { target: { value: '-5' } });
    submit('Edit Invoice');
    await errorFor('Choose an amount', 'Please enter an amount greater than $0');
    expect(sql).not.toHaveBeenCalled();
  });
});

describe('the customer form', () => {
  it('says what is missing or wrong, beside each field, and writes nothing', async () => {
    render(<CustomerForm />);
    // The browser's own check (type=email) would let this through; the action does not.
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'zorg@nowhere' } });
    submit('Create Customer');
    await errorFor('Name', 'Please enter a name.');
    await errorFor('Email', 'Please enter a valid email address.');
    expect(sql).not.toHaveBeenCalled();
  });
});
