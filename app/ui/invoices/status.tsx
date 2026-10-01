import clsx from 'clsx';

/** Paid: a lime outline pill. Pending: a filled violet pill. As in the mockup's invoice rows. */
export default function InvoiceStatus({ status }: { status: string }) {
  return (
    <span
      className={clsx(
        'inline-flex min-w-[52px] items-center justify-center rounded-full border px-3 py-1 text-[12.7px]',
        {
          'border-aura/60 bg-aura/25 text-white': status === 'pending',
          'border-plasma/70 text-plasma': status === 'paid',
        }
      )}
    >
      {status === 'pending' ? 'Pending' : null}
      {status === 'paid' ? 'Paid' : null}
    </span>
  );
}
