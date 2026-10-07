import { describe, expect, it } from 'vitest';
import {
  ChangePasswordForm,
  CreateInvoice,
  CustomerForm,
  CustomerId,
  InvoiceId,
  UpdateInvoice,
  addDays,
  dueDateProblem,
  parseStatusFilter,
} from '@/app/lib/schemas';

// The actions pass formData.get(...) straight in, so a missing field arrives as null.
const valid = { customerId: 'c0ffee', amount: '12.50', status: 'paid', dueDate: '2026-11-06' };

describe.each([
  ['CreateInvoice', CreateInvoice],
  ['UpdateInvoice', UpdateInvoice],
])('%s', (_name, schema) => {
  it('accepts a valid invoice and coerces the amount to a number', () => {
    const result = schema.safeParse(valid);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      customerId: 'c0ffee',
      amount: 12.5,
      status: 'paid',
      dueDate: '2026-11-06',
    });
  });

  it.each(['0', '-5', null])('rejects amount %s', (amount) => {
    const result = schema.safeParse({ ...valid, amount });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.amount).toEqual([
      'Please enter an amount greater than $0',
    ]);
  });

  it('rejects an amount that is not a number', () => {
    const result = schema.safeParse({ ...valid, amount: 'lots' });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.amount).toBeDefined();
  });

  it('asks for a customer when none is chosen', () => {
    const result = schema.safeParse({ ...valid, customerId: null });
    expect(result.error?.flatten().fieldErrors.customerId).toEqual(['Please select a customer.']);
  });

  it('asks for a status when none is chosen', () => {
    const result = schema.safeParse({ ...valid, status: null });
    expect(result.error?.flatten().fieldErrors.status).toEqual([
      'Please select an invoice status.',
    ]);
  });

  it('rejects a status other than pending or paid', () => {
    expect(schema.safeParse({ ...valid, status: 'overdue' }).success).toBe(false);
  });

  it('asks for a due date when none is given, or one that is not a date', () => {
    for (const dueDate of [null, '', '6/11/2026', '2026-11-6', '2026-11-06T00:00']) {
      const result = schema.safeParse({ ...valid, dueDate });
      expect(result.error?.flatten().fieldErrors.dueDate, String(dueDate)).toEqual([
        'Please choose a due date.',
      ]);
    }
  });

  it('refuses a due date that does not exist', () => {
    for (const dueDate of ['2026-02-30', '2026-13-01', '2025-02-29']) {
      const result = schema.safeParse({ ...valid, dueDate });
      expect(result.error?.flatten().fieldErrors.dueDate, dueDate).toEqual([
        'Please choose a real date.',
      ]);
    }
    expect(schema.safeParse({ ...valid, dueDate: '2028-02-29' }).success).toBe(true);
  });

  it('ignores an id or date sent by the client', () => {
    const result = schema.safeParse({ ...valid, id: 'x', date: '2020-01-01' });
    expect(result.data).not.toHaveProperty('id');
    expect(result.data).not.toHaveProperty('date');
  });
});

describe('CustomerForm', () => {
  const valid = { name: 'Zorg Industries', email: 'zorg@example.com' };

  it('accepts a name and an email address, trimmed', () => {
    expect(CustomerForm.parse({ name: '  Zorg  ', email: ' zorg@example.com ' })).toEqual({
      name: 'Zorg',
      email: 'zorg@example.com',
    });
  });

  it('needs a name', () => {
    for (const name of [null, '', '   ']) {
      const result = CustomerForm.safeParse({ ...valid, name });
      expect(result.error?.flatten().fieldErrors.name).toEqual(['Please enter a name.']);
    }
  });

  it('needs a valid email address', () => {
    for (const email of ['', 'not-an-email', 'a@', null]) {
      const result = CustomerForm.safeParse({ ...valid, email });
      expect(result.success).toBe(false);
      expect(result.error?.flatten().fieldErrors.email?.length).toBeGreaterThan(0);
    }
  });

  it('refuses a name or email longer than the database allows (255)', () => {
    expect(CustomerForm.safeParse({ ...valid, name: 'x'.repeat(256) }).success).toBe(false);
    expect(
      CustomerForm.safeParse({ ...valid, email: `${'x'.repeat(250)}@example.com` }).success
    ).toBe(false);
  });

  it('ignores anything else the client sends', () => {
    const result = CustomerForm.safeParse({ ...valid, id: 'x', image_url: 'evil' });
    expect(result.data).toEqual(valid);
  });
});

describe('InvoiceId', () => {
  it('is a UUID, or nothing', () => {
    expect(InvoiceId.safeParse('cc27c14a-0acf-4f4a-a6c9-d45682c144b9').success).toBe(true);
    for (const id of ['', 'i1', '../../etc', 'cc27c14a-0acf']) {
      expect(InvoiceId.safeParse(id).success).toBe(false);
    }
  });
});

describe('CustomerId', () => {
  it('is a UUID, or nothing', () => {
    expect(CustomerId.safeParse('3958dc9e-712f-4377-85e9-fec4b6a6442a').success).toBe(true);
    for (const id of ['', '1', "' OR 1=1 --", '3958dc9e-712f-4377-85e9']) {
      expect(CustomerId.safeParse(id).success).toBe(false);
    }
  });
});

describe('parseStatusFilter', () => {
  it('keeps a known status and drops anything else', () => {
    expect(parseStatusFilter('paid')).toBe('paid');
    expect(parseStatusFilter('pending')).toBe('pending');
    expect(parseStatusFilter('overdue')).toBe('overdue');
    for (const value of [undefined, '', 'PAID', 'Overdue', "paid' OR 1=1"]) {
      expect(parseStatusFilter(value)).toBeNull();
    }
  });
});

describe('ChangePasswordForm', () => {
  const form = (fields: Record<string, string | null> = {}) =>
    ChangePasswordForm.safeParse({
      currentPassword: 'old-password',
      newPassword: 'new-password-1',
      confirmPassword: 'new-password-1',
      ...fields,
    });
  const errors = (result: ReturnType<typeof form>) =>
    result.success ? {} : result.error.flatten().fieldErrors;

  it('takes a current password and a new one typed twice', () => {
    expect(form().success).toBe(true);
  });

  it('says what is missing, per field', () => {
    expect(
      errors(form({ currentPassword: null, newPassword: null, confirmPassword: null }))
    ).toEqual({
      currentPassword: ['Please enter your current password.'],
      newPassword: ['Please choose a new password.'],
      confirmPassword: ['Please type the new password again.'],
    });
    expect(errors(form({ currentPassword: '' })).currentPassword).toEqual([
      'Please enter your current password.',
    ]);
  });

  it('wants at least 8 characters and at most 72 bytes', () => {
    expect(errors(form({ newPassword: 'short1', confirmPassword: 'short1' })).newPassword).toEqual([
      'A new password needs at least 8 characters.',
    ]);
    // 24 three-byte characters: 72 bytes, the most bcrypt reads; one more is too long.
    const at72 = '€'.repeat(24);
    expect(form({ newPassword: at72, confirmPassword: at72 }).success).toBe(true);
    expect(
      errors(form({ newPassword: at72 + 'a', confirmPassword: at72 + 'a' })).newPassword
    ).toEqual(['A new password can be at most 72 bytes long.']);
  });

  it('refuses a confirmation that differs, and a new password equal to the current one', () => {
    expect(errors(form({ confirmPassword: 'something-else' })).confirmPassword).toEqual([
      'The two new passwords do not match.',
    ]);
    expect(
      errors(form({ newPassword: 'old-password', confirmPassword: 'old-password' })).newPassword
    ).toEqual(['The new password must differ from the current one.']);
  });
});

describe('the due date against the invoice date', () => {
  it('moves a date by days, across months and years', () => {
    expect(addDays('2026-10-08', 30)).toBe('2026-11-07');
    expect(addDays('2026-12-15', 30)).toBe('2027-01-14');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('may be the invoice date itself, or up to a year after it', () => {
    expect(dueDateProblem('2026-10-08', '2026-10-08')).toBeNull();
    expect(dueDateProblem('2026-11-07', '2026-10-08')).toBeNull();
    expect(dueDateProblem('2027-10-08', '2026-10-08')).toBeNull();
  });

  it('may not come before it, nor more than a year after it', () => {
    expect(dueDateProblem('2026-10-07', '2026-10-08')).toBe(
      'The due date cannot be before the invoice date.'
    );
    expect(dueDateProblem('2027-10-09', '2026-10-08')).toBe(
      'The due date can be at most a year after the invoice date.'
    );
  });
});
