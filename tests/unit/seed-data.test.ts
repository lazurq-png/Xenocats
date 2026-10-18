import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { customers, invoices } from '@/app/lib/placeholder-data';

// The seed (npm run db:seed) must satisfy the schema's keys, or seeding fails.

describe('the seed data', () => {
  it('names an existing customer on every invoice (invoices_customer_id_fkey)', () => {
    const ids = new Set(customers.map((customer) => customer.id));
    for (const invoice of invoices) expect(ids.has(invoice.customer_id)).toBe(true);
  });

  it('gives every invoice a due date 30 days after its date (invoices_due_date_check)', () => {
    for (const invoice of invoices) {
      const due = new Date(`${invoice.date}T00:00:00Z`);
      due.setUTCDate(due.getUTCDate() + 30);
      expect(invoice.due_date, invoice.date).toBe(due.toISOString().slice(0, 10));
    }
  });

  it('has unique customer ids', () => {
    expect(new Set(customers.map((customer) => customer.id)).size).toBe(customers.length);
  });
});

describe('the migrations', () => {
  const dir = new URL('../../db/migrations/', import.meta.url);
  const files = readdirSync(dir)
    .filter((name) => name.endsWith('.sql'))
    .sort();

  it('are numbered in order, without gaps', () => {
    files.forEach((name, i) => expect(name.slice(0, 4)).toBe(String(i + 1).padStart(4, '0')));
  });
});
