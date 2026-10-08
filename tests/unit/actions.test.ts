import bcryptjs from 'bcryptjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Nothing here reaches a database or a real session: `postgres`, `@/auth` and the
// Next.js runtime helpers the actions call are all replaced with fakes.
const { sql, auth, signIn, revalidatePath, redirect } = vi.hoisted(() => ({
  sql: vi.fn(),
  auth: vi.fn(),
  signIn: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock('postgres', () => ({ default: () => sql }));
vi.mock('@/auth', () => ({ auth, signIn }));
vi.mock('next-auth', () => ({
  AuthError: class AuthError extends Error {
    type = 'CredentialsSignin';
    code = 'credentials';
  },
}));
vi.mock('next/cache', () => ({ revalidatePath }));
vi.mock('next/navigation', () => ({ redirect }));

const { addDays } = await import('@/app/lib/schemas');

const {
  createInvoice,
  updateInvoice,
  deleteInvoice,
  deleteInvoiceAndReturn,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  authenticate,
  changePassword,
} = await import('@/app/lib/actions');

function invoiceForm(fields: Record<string, string> = {}) {
  const form = new FormData();
  const values = {
    customerId: 'c0ffee',
    amount: '12.50',
    status: 'paid',
    dueDate: addDays(new Date().toISOString().slice(0, 10), 30),
    ...fields,
  };
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

  const today = () => new Date().toISOString().slice(0, 10);

  it('createInvoice stores the amount in cents, dated today, due when the form says', async () => {
    const due = addDays(today(), 45);
    await createInvoice({}, invoiceForm({ dueDate: due }));
    expect(sql).toHaveBeenCalledTimes(1);
    expect(sql.mock.calls[0].slice(1)).toEqual(['c0ffee', 1250, 'paid', today(), due]);
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/invoices');
    expect(redirect).toHaveBeenCalledWith('/dashboard/invoices');
  });

  it('createInvoice refuses a due date before today, or more than a year on, and writes nothing', async () => {
    const before = await createInvoice({}, invoiceForm({ dueDate: addDays(today(), -1) }));
    expect(before.errors?.dueDate).toEqual(['The due date cannot be before the invoice date.']);
    const far = await createInvoice({}, invoiceForm({ dueDate: addDays(today(), 366) }));
    expect(far.errors?.dueDate).toEqual([
      'The due date can be at most a year after the invoice date.',
    ]);
    expect(sql).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("createInvoice reports the database's own due-date check as the field's error", async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    sql.mockRejectedValue(
      Object.assign(new Error('violates check constraint'), {
        constraint_name: 'invoices_due_date_check',
      })
    );
    const result = await createInvoice({}, invoiceForm());
    expect(result.errors?.dueDate).toEqual(['The due date cannot be before the invoice date.']);
    expect(redirect).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("updateInvoice reports the database's own due-date check as the field's error", async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    sql.mockResolvedValueOnce([{ date: '2026-01-10' }]).mockRejectedValueOnce(
      Object.assign(new Error('violates check constraint'), {
        constraint_name: 'invoices_due_date_check',
      })
    );
    const result = await updateInvoice(
      'cc27c14a-0acf-4f4a-a6c9-d45682c144b9',
      {},
      invoiceForm({ dueDate: '2026-02-09' })
    );
    expect(result.errors?.dueDate).toEqual(['The due date cannot be before the invoice date.']);
    expect(redirect).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('createInvoice still validates the form', async () => {
    const result = await createInvoice({}, invoiceForm({ amount: '0' }));
    expect(result.errors?.amount).toEqual(['Please enter an amount greater than $0']);
    expect(sql).not.toHaveBeenCalled();
  });

  const invoiceId = 'cc27c14a-0acf-4f4a-a6c9-d45682c144b9';

  it("updateInvoice checks the due date against the invoice's own date, writes and redirects", async () => {
    sql.mockResolvedValueOnce([{ date: '2026-01-10' }]).mockResolvedValueOnce([]);
    await updateInvoice(invoiceId, {}, invoiceForm({ status: 'pending', dueDate: '2026-03-01' }));
    expect(sql).toHaveBeenCalledTimes(2);
    expect(sql.mock.calls[0].slice(1)).toEqual([invoiceId]);
    expect(sql.mock.calls[1].slice(1)).toEqual([
      'c0ffee',
      1250,
      'pending',
      '2026-03-01',
      invoiceId,
    ]);
    expect(redirect).toHaveBeenCalledWith('/dashboard/invoices');
  });

  it('updateInvoice refuses a due date before the invoice date, and writes nothing', async () => {
    sql.mockResolvedValueOnce([{ date: '2026-01-10' }]);
    const result = await updateInvoice(invoiceId, {}, invoiceForm({ dueDate: '2026-01-09' }));
    expect(result.errors?.dueDate).toEqual(['The due date cannot be before the invoice date.']);
    // Only the read of its date.
    expect(sql).toHaveBeenCalledTimes(1);
    expect(redirect).not.toHaveBeenCalled();
  });

  it('updateInvoice says so when the invoice was deleted between the read and the write', async () => {
    sql
      .mockResolvedValueOnce([{ date: '2026-01-10' }])
      .mockResolvedValueOnce(Object.assign([], { count: 0 }));
    const result = await updateInvoice(invoiceId, {}, invoiceForm({ dueDate: '2026-02-09' }));
    expect(result).toEqual({ message: 'No such invoice.' });
    expect(redirect).not.toHaveBeenCalled();
  });

  it('updateInvoice names no invoice for an id that is not one, or one that does not exist', async () => {
    expect(await updateInvoice('i1', {}, invoiceForm())).toEqual({ message: 'No such invoice.' });
    expect(sql).not.toHaveBeenCalled();
    sql.mockResolvedValueOnce([]);
    expect(await updateInvoice(invoiceId, {}, invoiceForm())).toEqual({
      message: 'No such invoice.',
    });
    expect(sql).toHaveBeenCalledTimes(1);
    expect(redirect).not.toHaveBeenCalled();
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
    // The invoice, dated today (its due date is checked against it).
    sql.mockResolvedValueOnce([{ date: new Date().toISOString().slice(0, 10) }]);
    await updateInvoice(
      'cc27c14a-0acf-4f4a-a6c9-d45682c144b9',
      {},
      invoiceForm({ amount: '0.29' })
    );
    expect(sql.mock.calls[1][2]).toBe(29);
  });
});

describe('authenticate', () => {
  const failure = async (code: string) => {
    const { AuthError } = await import('next-auth');
    return Object.assign(new AuthError(), { code });
  };

  it('says the credentials are wrong, and nothing more', async () => {
    signIn.mockRejectedValue(await failure('credentials'));
    expect(await authenticate(undefined, new FormData())).toBe('Invalid credentials.');
  });

  it('says when the email is locked out', async () => {
    signIn.mockRejectedValue(await failure('locked'));
    expect(await authenticate(undefined, new FormData())).toBe(
      'Too many failed logins for this email. Try again later.'
    );
  });
});

describe('changePassword', () => {
  const passwordForm = (fields: Record<string, string> = {}) => {
    const form = new FormData();
    const values = {
      currentPassword: 'old-password',
      newPassword: 'new-password-1',
      confirmPassword: 'new-password-1',
      ...fields,
    };
    for (const [key, value] of Object.entries(values)) form.set(key, value);
    return form;
  };
  const statements = () => sql.mock.calls.map((call) => (call[0] as string[]).join('?'));

  it('refuses without a session, and touches nothing', async () => {
    auth.mockResolvedValue(null);
    expect(await changePassword({}, passwordForm())).toEqual({
      message: 'You must be logged in to change your password.',
    });
    expect(sql).not.toHaveBeenCalled();
  });

  it('refuses an invalid form before anything else', async () => {
    auth.mockResolvedValue(signedIn);
    const result = await changePassword({}, passwordForm({ confirmPassword: 'other-password' }));
    expect(result.errors?.confirmPassword).toEqual(['The two new passwords do not match.']);
    expect(sql).not.toHaveBeenCalled();
  });

  it('refuses a wrong current password, and changes nothing', async () => {
    auth.mockResolvedValue(signedIn);
    const hash = await bcryptjs.hash('the-real-one', 4);
    sql
      .mockResolvedValueOnce([{ attempt: 1 }])
      .mockResolvedValueOnce([{ id: 'u1', password: hash }]);
    const result = await changePassword({}, passwordForm());
    expect(result.errors?.currentPassword).toEqual(['That is not your current password.']);
    expect(statements().some((text) => text.includes('UPDATE users'))).toBe(false);
  });

  it('refuses while the account is locked out, before comparing', async () => {
    auth.mockResolvedValue(signedIn);
    sql.mockResolvedValueOnce([{ attempt: 99 }]);
    expect((await changePassword({}, passwordForm())).message).toBe(
      'Too many failed attempts for this account. Try again later.'
    );
    expect(sql).toHaveBeenCalledTimes(1);
  });

  it('stores a bcrypt hash of the new password for the logged-in user', async () => {
    auth.mockResolvedValue(signedIn);
    const hash = await bcryptjs.hash('old-password', 4);
    sql
      .mockResolvedValueOnce([{ attempt: 1 }])
      .mockResolvedValueOnce([{ id: 'u1', password: hash }]);
    expect(await changePassword({}, passwordForm())).toEqual({
      done: true,
      message: 'Your password has been changed.',
    });
    // Counted apart from logins, so failed logins cannot block a change.
    expect(sql.mock.calls[0][1]).toBe('change-password:user@example.com');
    // Looked up by the session's email, never by anything the form sends.
    expect(sql.mock.calls[1].slice(1)).toEqual(['user@example.com']);
    const update = sql.mock.calls.find((call) =>
      (call[0] as string[]).join('?').includes('UPDATE users')
    )!;
    const [stored, id] = update.slice(1) as [string, string];
    expect(id).toBe('u1');
    expect(stored).not.toContain('new-password-1');
    expect(await bcryptjs.compare('new-password-1', stored)).toBe(true);
  });
});
