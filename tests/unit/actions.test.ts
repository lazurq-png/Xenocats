import bcryptjs from 'bcryptjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Nothing here reaches a database or a real session: `postgres`, `@/auth` and the
// Next.js runtime helpers the actions call are all replaced with fakes.
const { sql, locks, auth, signIn, signOut, revalidatePath, redirect } = vi.hoisted(() => ({
  // A transaction (sql.begin) runs its statements on the same fake, except the lock
  // on the account it takes first, which goes to `locks` (whose account, in order).
  sql: Object.assign(vi.fn(), { begin: vi.fn() }),
  locks: [] as unknown[],
  auth: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock('postgres', () => ({ default: () => sql }));
vi.mock('@/auth', () => ({ auth, signIn, signOut }));
vi.mock('next-auth', () => ({
  AuthError: class AuthError extends Error {
    type = 'CredentialsSignin';
    code = 'credentials';
  },
}));
vi.mock('next/cache', () => ({ revalidatePath }));
vi.mock('next/navigation', () => ({ redirect }));
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-real-ip': '203.0.113.7' }),
}));

const { addDays, MAX_CUSTOMERS_PER_ACCOUNT, MAX_INVOICES_PER_ACCOUNT, MAX_RUN_MS } =
  await import('@/app/lib/schemas');

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
  signUp,
  recordSurvivalRun,
  startSurvivalRun,
} = await import('@/app/lib/actions');

/** A customer's id: the database decides whether it is the user's own. */
const customerId = 'c0ffee00-0000-4000-8000-000000000001';

function invoiceForm(fields: Record<string, string> = {}) {
  const form = new FormData();
  const values = {
    customerId,
    amount: '12.50',
    status: 'paid',
    dueDate: addDays(new Date().toISOString().slice(0, 10), 30),
    ...fields,
  };
  for (const [key, value] of Object.entries(values)) form.set(key, value);
  return form;
}

const signedIn = { user: { id: 'u1', name: 'User', email: 'user@example.com' } };

// The sign-up limit keys addresses with the app's secret (sign-up-limit.ts).
vi.stubEnv('AUTH_SECRET', 'a secret for the tests');

beforeEach(() => {
  vi.clearAllMocks();
  sql.mockResolvedValue([]);
  locks.length = 0;
  sql.begin.mockImplementation((statements: (tx: unknown) => unknown) =>
    statements((strings: TemplateStringsArray, ...values: unknown[]) => {
      if (strings.join('').includes('pg_advisory_xact_lock')) return (locks.push(values[0]), []);
      return sql(strings, ...values);
    })
  );
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
    // The account is held first, so creates sent at once count each other's rows.
    expect(locks).toEqual(['account:u1']);
    expect(sql).toHaveBeenCalledTimes(1);
    // For the customer only if it is the session's user's own, and while the account
    // holds fewer than the most invoices it may.
    expect(sql.mock.calls[0].slice(1)).toEqual([
      1250,
      'paid',
      today(),
      due,
      customerId,
      'u1',
      'u1',
      MAX_INVOICES_PER_ACCOUNT,
    ]);
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
    sql.mockResolvedValueOnce([{ date: '2026-01-10', own_customer: true }]).mockRejectedValueOnce(
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

  it("createInvoice refuses a customer that is not the user's own, as one that does not exist", async () => {
    // The insert matched no customer of the user's (and the account is not full).
    sql.mockResolvedValueOnce(Object.assign([], { count: 0 }));
    sql.mockResolvedValueOnce([{ n: 3 }]);
    const refused = {
      errors: { customerId: ['That customer does not exist.'] },
      message: 'Failed to create the invoice.',
    };
    expect(await createInvoice({}, invoiceForm())).toEqual(refused);
    // Anything but a UUID names no customer, and never reaches the database.
    expect(await createInvoice({}, invoiceForm({ customerId: "' OR 1=1 --" }))).toEqual(refused);
    // The insert, and the look at why it matched nothing.
    expect(sql).toHaveBeenCalledTimes(2);
    expect(redirect).not.toHaveBeenCalled();
  });

  it('createInvoice refuses an account that holds the most invoices it may, and says so', async () => {
    sql.mockResolvedValueOnce(Object.assign([], { count: 0 }));
    sql.mockResolvedValueOnce([{ n: MAX_INVOICES_PER_ACCOUNT }]);
    expect(await createInvoice({}, invoiceForm())).toEqual({
      message: 'An account holds at most 10,000 invoices. Delete some to create more.',
    });
    // The check is in the insert itself, for this owner.
    expect(sql.mock.calls[0].slice(-2)).toEqual(['u1', MAX_INVOICES_PER_ACCOUNT]);
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it('createInvoice still validates the form', async () => {
    const result = await createInvoice({}, invoiceForm({ amount: '0' }));
    expect(result.errors?.amount).toEqual(['Please enter an amount greater than $0']);
    expect(sql).not.toHaveBeenCalled();
  });

  const invoiceId = 'cc27c14a-0acf-4f4a-a6c9-d45682c144b9';

  it("updateInvoice checks the due date against the invoice's own date, writes and redirects", async () => {
    sql
      .mockResolvedValueOnce([{ date: '2026-01-10', own_customer: true }])
      .mockResolvedValueOnce([]);
    await updateInvoice(invoiceId, {}, invoiceForm({ status: 'pending', dueDate: '2026-03-01' }));
    expect(sql).toHaveBeenCalledTimes(2);
    // The user's own invoice, moved only to one of the user's own customers.
    expect(sql.mock.calls[0].slice(1)).toEqual([customerId, 'u1', invoiceId, 'u1']);
    expect(sql.mock.calls[1].slice(1)).toEqual([
      customerId,
      1250,
      'pending',
      '2026-03-01',
      invoiceId,
      'u1',
      customerId,
      'u1',
    ]);
    expect(redirect).toHaveBeenCalledWith('/dashboard/invoices');
  });

  it('updateInvoice refuses a due date before the invoice date, and writes nothing', async () => {
    sql.mockResolvedValueOnce([{ date: '2026-01-10', own_customer: true }]);
    const result = await updateInvoice(invoiceId, {}, invoiceForm({ dueDate: '2026-01-09' }));
    expect(result.errors?.dueDate).toEqual(['The due date cannot be before the invoice date.']);
    // Only the read of its date.
    expect(sql).toHaveBeenCalledTimes(1);
    expect(redirect).not.toHaveBeenCalled();
  });

  it('updateInvoice says so when the invoice was deleted between the read and the write', async () => {
    sql
      .mockResolvedValueOnce([{ date: '2026-01-10', own_customer: true }])
      .mockResolvedValueOnce(Object.assign([], { count: 0 }));
    const result = await updateInvoice(invoiceId, {}, invoiceForm({ dueDate: '2026-02-09' }));
    expect(result).toEqual({ message: 'No such invoice.' });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("updateInvoice refuses to move an invoice to a customer that is not the user's own", async () => {
    sql.mockResolvedValueOnce([{ date: '2026-01-10', own_customer: false }]);
    expect(await updateInvoice(invoiceId, {}, invoiceForm({ dueDate: '2026-02-09' }))).toEqual({
      errors: { customerId: ['That customer does not exist.'] },
      message: 'Failed to update the invoice.',
    });
    // Only the read.
    expect(sql).toHaveBeenCalledTimes(1);
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

  it("deleteInvoice deletes the user's own invoice and revalidates the list", async () => {
    await deleteInvoice('cc27c14a-0acf-4f4a-a6c9-d45682c144b9');
    expect(sql.mock.calls[0].slice(1)).toEqual(['cc27c14a-0acf-4f4a-a6c9-d45682c144b9', 'u1']);
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
      expect(locks).toEqual(['account:u1']);
      expect(sql).toHaveBeenCalledTimes(1);
      expect(sql.mock.calls[0].slice(1, 3)).toEqual(['Orbital Snacks', 'orbit@example.com']);
      // The session's user owns it.
      expect(sql.mock.calls[0][3]).toBe('u1');
      for (const path of [
        '/dashboard/customers',
        '/dashboard/invoices',
        '/dashboard/invoices/create',
      ]) {
        expect(revalidatePath).toHaveBeenCalledWith(path);
      }
      expect(redirect).toHaveBeenCalledWith('/dashboard/customers');
    });

    it('createCustomer refuses an account that holds the most customers it may, and says so', async () => {
      // The insert's own check held it back.
      sql.mockResolvedValueOnce(Object.assign([], { count: 0 }));
      expect(await createCustomer({}, customerForm())).toEqual({
        message: 'An account holds at most 1,000 customers. Delete some to create more.',
      });
      expect(sql).toHaveBeenCalledTimes(1);
      expect(sql.mock.calls[0].slice(-2)).toEqual(['u1', MAX_CUSTOMERS_PER_ACCOUNT]);
      expect(revalidatePath).not.toHaveBeenCalled();
      expect(redirect).not.toHaveBeenCalled();
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
    expect(sql.mock.calls[0][1]).toBe(1000037);
    sql.mockClear();
    // The invoice, dated today (its due date is checked against it).
    sql.mockResolvedValueOnce([
      { date: new Date().toISOString().slice(0, 10), own_customer: true },
    ]);
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

  it('says when the login name is locked out', async () => {
    signIn.mockRejectedValue(await failure('locked'));
    expect(await authenticate(undefined, new FormData())).toBe(
      'Too many failed logins for this account. Try again later.'
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
    expect(signOut).not.toHaveBeenCalled();
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
    expect(sql.mock.calls[0][1]).toBe('change-password:u1');
    // Looked up by the session's id (an account may have no email), never by
    // anything the form sends.
    expect(sql.mock.calls[1].slice(1)).toEqual(['u1']);
    const update = sql.mock.calls.find((call) =>
      (call[0] as string[]).join('?').includes('UPDATE users')
    )!;
    const [stored, id] = update.slice(1) as [string, string];
    expect(id).toBe('u1');
    expect(stored).not.toContain('new-password-1');
    expect(await bcryptjs.compare('new-password-1', stored)).toBe(true);
    // Every session of the account ends, this one too: off to the login.
    expect((update[0] as string[]).join('?')).toContain('session_version = session_version + 1');
    expect(signOut).toHaveBeenCalledWith({ redirectTo: '/login?password-changed=1' });
  });
});

describe('signUp', () => {
  const signUpForm = (fields: Record<string, string> = {}) => {
    const form = new FormData();
    const values = {
      username: 'Nebula_Kit',
      password: 'a-good-password',
      confirmPassword: 'a-good-password',
      ...fields,
    };
    for (const [key, value] of Object.entries(values)) form.set(key, value);
    return form;
  };

  /** The sign-up limit's count for this address: the first today unless said otherwise. */
  const counted = (signUps = 1) => sql.mockResolvedValueOnce([{ sign_ups: signUps }]);

  it('makes the account with a bcrypt hash and no email, then signs it in', async () => {
    counted();
    sql.mockResolvedValueOnce(Object.assign([], { count: 1 }));
    // (In the app it redirects, by throwing; here it just returns.)
    signIn.mockResolvedValueOnce(undefined);
    expect(await signUp({}, signUpForm({ username: '  Nebula_Kit ' }))).toEqual({});
    const [strings, name, username, hash] = sql.mock.calls[1] as [string[], ...string[]];
    expect(strings.join('?')).toContain('INSERT INTO users (name, username, password)');
    expect([name, username]).toEqual(['Nebula_Kit', 'Nebula_Kit']);
    expect(hash).not.toContain('a-good-password');
    expect(await bcryptjs.compare('a-good-password', hash)).toBe(true);
    expect(signIn).toHaveBeenCalledWith('credentials', {
      login: 'Nebula_Kit',
      password: 'a-good-password',
      redirectTo: '/dashboard',
    });
  });

  it('counts the sign-up under a hash of the address, never the address itself', async () => {
    counted();
    sql.mockResolvedValueOnce(Object.assign([], { count: 1 }));
    signIn.mockResolvedValueOnce(undefined);
    await signUp({}, signUpForm());
    const [strings, key] = sql.mock.calls[0] as [string[], string];
    expect(strings.join('?')).toContain('INSERT INTO sign_up_limits');
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(key).not.toContain('203.0.113.7');
  });

  it('refuses a sign-up past the limit a day from one address, and makes nothing', async () => {
    counted(3);
    expect(await signUp({}, signUpForm())).toEqual({
      message: 'Too many accounts were made from here today. Try again tomorrow.',
    });
    expect(sql).toHaveBeenCalledTimes(1);
    expect(signIn).not.toHaveBeenCalled();
  });

  it('refuses a taken username, and signs nobody in', async () => {
    counted();
    sql.mockResolvedValueOnce(Object.assign([], { count: 0 }));
    const result = await signUp({}, signUpForm());
    expect(result.errors?.username).toEqual(['That username is taken.']);
    expect(signIn).not.toHaveBeenCalled();
  });

  it('refuses an invalid form before touching the database', async () => {
    for (const [fields, field, message] of [
      [{ username: 'ab' }, 'username', 'A username is 3 to 20 letters, digits, "_" or "-".'],
      [
        { username: 'me@example.com' },
        'username',
        'A username is 3 to 20 letters, digits, "_" or "-".',
      ],
      [
        { username: 'change-password:u1' },
        'username',
        'A username is 3 to 20 letters, digits, "_" or "-".',
      ],
      [
        { password: 'short', confirmPassword: 'short' },
        'password',
        'A password needs at least 8 characters.',
      ],
      [
        { password: 'x'.repeat(73), confirmPassword: 'x'.repeat(73) },
        'password',
        'A password can be at most 72 bytes long.',
      ],
      [{ confirmPassword: 'something-else' }, 'confirmPassword', 'The two passwords do not match.'],
    ] as const) {
      const result = await signUp({}, signUpForm(fields));
      expect(result.errors?.[field]).toEqual([message]);
    }
    expect(sql).not.toHaveBeenCalled();
    expect(signIn).not.toHaveBeenCalled();
  });
});

describe('startSurvivalRun', () => {
  it('starts a run of a real length for the signed-in player, and gives its id', async () => {
    auth.mockResolvedValue(signedIn);
    sql.mockResolvedValueOnce([{ id: 'run-1' }]);
    expect(await startSurvivalRun(10)).toBe('run-1');
    expect(sql.mock.calls[0].slice(1)).toEqual(['u1', 10]);
  });

  it('starts an endless run as minutes 0', async () => {
    auth.mockResolvedValue(signedIn);
    sql.mockResolvedValueOnce([{ id: 'run-2' }]);
    expect(await startSurvivalRun(0)).toBe('run-2');
    expect(sql.mock.calls[0].slice(1)).toEqual(['u1', 0]);
  });

  it('starts nothing signed out, or for a length there is none of', async () => {
    auth.mockResolvedValue(null);
    expect(await startSurvivalRun(5)).toBeNull();
    auth.mockResolvedValue(signedIn);
    for (const minutes of [7, '5', null, 5.5, -1, '0']) {
      expect(await startSurvivalRun(minutes)).toBeNull();
    }
    expect(sql).not.toHaveBeenCalled();
  });
});

describe('recordSurvivalRun', () => {
  const runId = 'c0ffee00-0000-4000-8000-0000000000aa';
  const run = { runId, name: '  Comet   Tail ', timeMs: 312_000, sentHome: 87 };

  it('refuses without a session, and writes nothing', async () => {
    auth.mockResolvedValue(null);
    expect(await recordSurvivalRun(run)).toBe('signed-out');
    expect(sql).not.toHaveBeenCalled();
  });

  it('finishes the player’s own run, under the typed name tidied, and only once', async () => {
    auth.mockResolvedValue(signedIn);
    sql.mockResolvedValueOnce(Object.assign([], { count: 1 }));
    expect(await recordSurvivalRun(run)).toBe('saved');
    const [strings, ...values] = sql.mock.calls[0] as [string[], ...unknown[]];
    const text = strings.join('?');
    expect(text).toContain('UPDATE survival_runs');
    // Its own, unfinished, within its length and the time since it started.
    expect(text).toMatch(/user_id = \? AND finished_at IS NULL/);
    expect(text).toContain('run_minutes * 60000');
    // An endless run (minutes 0) is held to the time since it started alone.
    expect(text).toContain('run_minutes = 0 OR');
    expect(text).toContain('now() - started_at');
    expect(values.slice(0, 5)).toEqual(['Comet Tail', 312_000, 87, runId, 'u1']);
    expect(revalidatePath).toHaveBeenCalledWith('/cats');
  });

  it('sends an endless run longer than any timed one on to the database to judge', async () => {
    auth.mockResolvedValue(signedIn);
    sql.mockResolvedValueOnce(Object.assign([], { count: 1 }));
    expect(await recordSurvivalRun({ ...run, timeMs: 2 * 3_600_000 })).toBe('saved');
    expect(sql).toHaveBeenCalledTimes(1);
  });

  it('says invalid when the database finds no such run to finish', async () => {
    auth.mockResolvedValue(signedIn);
    sql.mockResolvedValueOnce(Object.assign([], { count: 0 }));
    expect(await recordSurvivalRun(run)).toBe('invalid');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('refuses a run no game could have reported, and writes nothing', async () => {
    auth.mockResolvedValue(signedIn);
    for (const bad of [
      { ...run, name: '   ' },
      { ...run, name: 'x'.repeat(21) },
      { ...run, name: '‮gnirts' },
      { ...run, name: 'a​b' },
      { ...run, name: 'admin\u0000' },
      { ...run, name: '<script>' },
      { ...run, runId: 'not-a-uuid' },
      { ...run, timeMs: MAX_RUN_MS + 1 },
      { ...run, timeMs: -1 },
      { ...run, sentHome: 1.5 },
      'not a run',
    ]) {
      expect(await recordSurvivalRun(bad)).toBe('invalid');
    }
    expect(sql).not.toHaveBeenCalled();
  });
});
