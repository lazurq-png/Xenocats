import { EyeIcon, PencilIcon, PlusIcon } from '@heroicons/react/20/solid';
import Link from 'next/link';

export { DeleteInvoice } from './delete-invoice';

export function CreateInvoice() {
  return (
    <Link
      href="/dashboard/invoices/create"
      className="flex h-10 items-center rounded-xl bg-plasma px-4 text-sm font-semibold text-void transition hover:shadow-glow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plasma"
    >
      <span className="hidden md:block">Create Invoice</span> <PlusIcon className="h-5 md:ml-4" />
    </Link>
  );
}

export function UpdateInvoice({ id }: { id: string }) {
  return (
    <Link
      href={`/dashboard/invoices/${id}/edit`}
      className="rounded-lg border border-line p-2 text-aura transition-colors hover:border-aura hover:text-white"
    >
      <span className="sr-only">Edit</span>
      <PencilIcon className="w-5" />
    </Link>
  );
}

export function ViewInvoice({ id, label }: { id: string; label: string }) {
  return (
    <Link
      href={`/dashboard/invoices/${id}`}
      className="rounded-lg border border-line p-2 text-aura transition-colors hover:border-aura hover:text-white"
    >
      <span className="sr-only">View {label}</span>
      <EyeIcon className="w-5" />
    </Link>
  );
}
