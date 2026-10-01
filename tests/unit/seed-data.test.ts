import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { customers, invoices } from '@/app/lib/placeholder-data';

// The seed (npm run db:seed) must satisfy the schema's keys, or seeding fails.

describe('the seed data', () => {
  it('names an existing customer on every invoice (invoices_customer_id_fkey)', () => {
    const ids = new Set(customers.map((customer) => customer.id));
    for (const invoice of invoices) expect(ids.has(invoice.customer_id)).toBe(true);
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

  it('add the invoice key and indexes without dropping anything', () => {
    const body = readFileSync(new URL('0002_invoice_keys_and_indexes.sql', dir), 'utf8');
    expect(body).toMatch(/REFERENCES customers \(id\) ON DELETE RESTRICT/);
    expect(body).not.toMatch(/\bDROP\b/i);
  });
});
