import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import InvoiceStatus from '@/app/ui/invoices/status';

// The status pill: each invoice shows exactly one of Paid, Pending and Overdue.
const text = (element: React.ReactElement) => renderToStaticMarkup(element).replace(/<[^>]+>/g, '');

describe('InvoiceStatus', () => {
  it('says Pending for an unpaid invoice not yet due, and Paid for a paid one', () => {
    expect(text(<InvoiceStatus status="pending" />)).toBe('Pending');
    expect(text(<InvoiceStatus status="paid" />)).toBe('Paid');
  });

  it('says Overdue, instead of Pending, for an unpaid invoice past its due date', () => {
    expect(text(<InvoiceStatus status="pending" overdue />)).toBe('Overdue');
  });

  it('never calls a paid invoice overdue', () => {
    expect(text(<InvoiceStatus status="paid" overdue />)).toBe('Paid');
  });
});
