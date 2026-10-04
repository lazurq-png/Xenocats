import clsx from 'clsx';

/**
 * Paid: a lime outline pill. Pending: a filled violet pill. As in the mockup's
 * invoice rows. Overdue (pending, past its due date): a filled lime pill instead
 * of Pending.
 */
export default function InvoiceStatus({
  status,
  overdue = false,
}: {
  status: string;
  overdue?: boolean;
}) {
  const shown = status === 'pending' && overdue ? 'overdue' : status;
  return (
    <span
      className={clsx(
        'inline-flex min-w-[52px] items-center justify-center rounded-full border px-3 py-1 text-[12.7px]',
        {
          'border-aura/60 bg-aura/25 text-white': shown === 'pending',
          'border-plasma/70 text-plasma': shown === 'paid',
          'border-plasma bg-plasma font-medium text-void': shown === 'overdue',
        }
      )}
    >
      {shown === 'pending' ? 'Pending' : null}
      {shown === 'paid' ? 'Paid' : null}
      {shown === 'overdue' ? 'Overdue' : null}
    </span>
  );
}
