import { beforeEach, describe, expect, it, vi } from 'vitest';

// Nothing here reaches a database or a real session: `postgres`, `@/auth` and the
// Next.js runtime helpers the actions call are all replaced with fakes.
const { sql, auth, revalidatePath, redirect } = vi.hoisted(() => ({
  sql: vi.fn(),
  auth: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock('postgres', () => ({ default: () => sql }));
vi.mock('@/auth', () => ({ auth, signIn: vi.fn() }));
vi.mock('next-auth', () => ({ AuthError: class AuthError extends Error {} }));
vi.mock('next/cache', () => ({ revalidatePath }));
vi.mock('next/navigation', () => ({ redirect }));

const {
  createInvoice,
  updateInvoice,
  deleteInvoice,
  deleteInvoiceAndReturn,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} = await import('@/app/lib/actions');

function invoiceForm(fields: Record<string, string> = {}) {
  const form = new FormData();
  const values = { customerId: 'c0ffee', amount: '12.50', status: 'paid', ...fields };
  for (const [key, value] of Object.entries(values)) form.set(key, value);
  return form;
}

const signedIn = { user: { id: 'u1', name: 'User', email: 'user@example.com' } };

beforeEach(() => {
  vi.clearAllMocks();
  sql.mockResolvedValue([]);
});

describe('without a session', () => {
  beforeEach(() => auth.mockResolvedValue(null));

  it('createInvoice refuses and writes nothing', async () => {
    const result = await createInvoice({}, invoiceForm());
    expect(result).toEqual({ message: 'You must be logged in to create an invoice.' });
    expect(sql).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it('createInvoice refuses before validating, so it reveals nothing about the form', async () => {
    const result = await createInvoice({}, invoiceForm({ amount: '-1' }));
    expect(result).toEqual({ message: 'You must be logged in to create an invoice.' });
  });

  it('updateInvoice refuses and writes nothing', async () => {
    const result = await updateInvoice('i1', {}, invoiceForm());
    expect(result).toEqual({ message: 'You must be logged in to update an invoice.' });
    expect(sql).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it('deleteInvoice refuses and writes nothing', async () => {
    await expect(deleteInvoice('i1')).rejects.toThrow('Unauthorized');
    expect(sql).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('deleteInvoice refuses even before looking at the id', async () => {
    await expect(deleteInvoice('not-a-uuid')).rejects.toThrow('Unauthorized');
    expect(sql).not.toHaveBeenCalled();
  });

  it('treats a session without a user as signed out', async () => {
    auth.mockResolvedValue({ expires: '2099-01-01' });
    await expect(deleteInvoice('i1')).rejects.toThrow('Unauthorized');
    expect(sql).not.toHaveBeenCalled();
  });
});

describe('with a session', () => {
  beforeEach(() => auth.mockResolvedValue(signedIn));

  it('createInvoice stores the amount in cents and redirects to the list', async () => {
    await createInvoice({}, invoiceForm());
    expect(sql).toHaveBeenCalledTimes(1);
    expect(sql.mock.calls[0].slice(1)).toEqual(['c0ffee', 1250, 'paid', expect.any(String)]);
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/invoices');
    expect(redirect).toHaveBeenCalledWith('/dashboard/invoices');
  });

  it('createInvoice still validates the form', async () => {
    const result = await createInvoice({}, invoiceForm({ amount: '0' }));
    expect(result.errors?.amount).toEqual(['Please enter an amount greater than $0']);
    expect(sql).not.toHaveBeenCalled();
  });

  it('updateInvoice writes and redirects', async () => {
    await updateInvoice('i1', {}, invoiceForm({ status: 'pending' }));
    expect(sql).toHaveBeenCalledTimes(1);
    expect(sql.mock.calls[0].slice(1)).toEqual(['c0ffee', 1250, 'pending', 'i1']);
    expect(redirect).toHaveBeenCalledWith('/dashboard/invoices');
  });

  it('deleteInvoice deletes and revalidates the list', async () => {
    await deleteInvoice('cc27c14a-0acf-4f4a-a6c9-d45682c144b9');
    expect(sql.mock.calls[0].slice(1)).toEqual(['cc27c14a-0acf-4f4a-a6c9-d45682c144b9']);
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/invoices');
  });

  it('deleteInvoice hides the database error from the client', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    sql.mockRejectedValue(new Error('connection to db.internal:5432 refused'));
    const failure = deleteInvoice('cc27c14a-0acf-4f4a-a6c9-d45682c144b9');
    await expect(failure).rejects.toThrow('Database Error: Failed to Delete Invoice.');
    await expect(failure).rejects.not.toThrow(/db\.internal/);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

describe('customer actions', () => {
  const id = '3958dc9e-712f-4377-85e9-fec4b6a6442a';
  const customerForm = (fields: Record<string, string> = {}) => {
    const form = new FormData();
    const values = { name: ' Orbital Snacks ', email: ' orbit@example.com ', ...fields };
    for (const [key, value] of Object.entries(values)) form.set(key, value);
    return form;
  };

  describe('without a session', () => {
    beforeEach(() => auth.mockResolvedValue(null));

    it('all three refuse, write nothing, and reveal nothing about the input', async () => {
      expect(await createCustomer({}, customerForm({ email: 'bad' }))).toEqual({
        message: 'You must be logged in to create a customer.',
      });
      expect(await updateCustomer(id, {}, customerForm())).toEqual({
        message: 'You must be logged in to update a customer.',
      });
      expect(await deleteCustomer('not-a-uuid', {})).toEqual({
        message: 'You must be logged in to delete a customer.',
      });
      expect(sql).not.toHaveBeenCalled();
      expect(redirect).not.toHaveBeenCalled();
      expect(revalidatePath).not.toHaveBeenCalled();
    });
  });

  describe('with a session', () => {
    beforeEach(() => auth.mockResolvedValue(signedIn));

    it('createCustomer stores the trimmed values and refreshes everything that shows customers', async () => {
      await createCustomer({}, customerForm());
      expect(sql).toHaveBeenCalledTimes(1);
      expect(sql.mock.calls[0].slice(1, 3)).toEqual(['Orbital Snacks', 'orbit@example.com']);
      for (const path of [
        '/dashboard/customers',
        '/dashboard/invoices',
        '/dashboard/invoices/create',
      ]) {
        expect(revalidatePath).toHaveBeenCalledWith(path);
      }
      expect(redirect).toHaveBeenCalledWith('/dashboard/customers');
    });

    it('createCustomer validates and writes nothing on bad input', async () => {
      const result = await createCustomer({}, customerForm({ name: '  ', email: 'nope' }));
      expect(result.errors).toEqual({
        name: ['Please enter a name.'],
        email: ['Please enter a valid email address.'],
      });
      expect(sql).not.toHaveBeenCalled();
    });

    it('a malformed id never reaches the database', async () => {
      for (const bad of ['', '1', "' OR 1=1 --"]) {
        expect(await updateCustomer(bad, {}, customerForm())).toEqual({
          message: 'That customer does not exist.',
        });
        expect(await deleteCustomer(bad, {})).toEqual({ message: 'That customer does not exist.' });
      }
      expect(sql).not.toHaveBeenCalled();
    });

    it('updateCustomer says so when the customer is gone, without redirecting', async () => {
      sql.mockResolvedValue(Object.assign([], { count: 0 }));
      expect(await updateCustomer(id, {}, customerForm())).toEqual({
        message: 'That customer does not exist.',
      });
      expect(redirect).not.toHaveBeenCalled();
    });

    it('deleteCustomer reports a customer who still has invoices', async () => {
      sql.mockRejectedValue(Object.assign(new Error('fk'), { code: '23503' }));
      expect(await deleteCustomer(id, {})).toEqual({
        message: 'This customer still has invoices. Delete or reassign them first.',
      });
      expect(revalidatePath).not.toHaveBeenCalled();
    });

    it('any other database error is generic, and logged on the server only', async () => {
      const log = vi.spyOn(console, 'error').mockImplementation(() => {});
      sql.mockRejectedValue(Object.assign(new Error('secret detail'), { code: '57P01' }));
      const result = await deleteCustomer(id, {});
      expect(result).toEqual({ message: 'Database Error: Failed to delete the customer.' });
      expect(JSON.stringify(result)).not.toContain('secret');
      expect(log).toHaveBeenCalled();
      log.mockRestore();
    });

    it('deleteCustomer refuses a customer with invoices itself, before any key', async () => {
      // The delete matches nothing because invoices exist; the customer does.
      sql.mockResolvedValueOnce(Object.assign([], { count: 0 })).mockResolvedValueOnce([{}]);
      expect(await deleteCustomer(id, {})).toEqual({
        message: 'This customer still has invoices. Delete or reassign them first.',
      });
      // …and tells a customer that is gone apart.
      sql.mockResolvedValueOnce(Object.assign([], { count: 0 })).mockResolvedValueOnce([]);
      expect(await deleteCustomer(id, {})).toEqual({ message: 'That customer does not exist.' });
      expect(revalidatePath).not.toHaveBeenCalled();
    });

    it('a successful delete refreshes the lists', async () => {
      expect(await deleteCustomer(id, {})).toEqual({ message: null });
      expect(revalidatePath).toHaveBeenCalledWith('/dashboard/invoices/create');
    });
  });
});

describe('deleteInvoice with a session', () => {
  beforeEach(() => auth.mockResolvedValue(signedIn));

  it('a malformed id never reaches the database', async () => {
    for (const bad of ['', 'i1', "' OR 1=1 --"]) {
      await expect(deleteInvoice(bad)).rejects.toThrow('No such invoice.');
    }
    expect(sql).not.toHaveBeenCalled();
  });

  it('from the detail page, deletes and then goes to the list', async () => {
    await deleteInvoiceAndReturn('3958dc9e-712f-4377-85e9-fec4b6a6442a');
    expect(sql).toHaveBeenCalledTimes(1);
    expect(redirect).toHaveBeenCalledWith('/dashboard/invoices');
  });

  it('from the detail page, goes nowhere when the delete is refused', async () => {
    await expect(deleteInvoiceAndReturn('bad')).rejects.toThrow('No such invoice.');
    expect(redirect).not.toHaveBeenCalled();
  });

  it('deletes by id and refreshes the list', async () => {
    await deleteInvoice('3958dc9e-712f-4377-85e9-fec4b6a6442a');
    expect(sql).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/invoices');
  });
});

describe('amounts in cents', () => {
  beforeEach(() => auth.mockResolvedValue(signedIn));

  it('are whole numbers, even where floating point is not (10000.37 × 100)', async () => {
    await createInvoice({}, invoiceForm({ amount: '10000.37' }));
    expect(sql.mock.calls[0][2]).toBe(1000037);
    sql.mockClear();
    await updateInvoice(
      'cc27c14a-0acf-4f4a-a6c9-d45682c144b9',
      {},
      invoiceForm({ amount: '0.29' })
    );
    expect(sql.mock.calls[0][2]).toBe(29);
  });
});
