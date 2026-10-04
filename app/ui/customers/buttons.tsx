'use client';

import Link from 'next/link';
import { useActionState, useId } from 'react';
import { PencilIcon, PlusIcon, TrashIcon } from '@heroicons/react/20/solid';
import { type CustomerState, deleteCustomer } from '@/app/lib/actions';

export function CreateCustomer() {
  return (
    <Link
      href="/dashboard/customers/create"
      className="flex h-10 items-center rounded-xl bg-plasma px-4 text-sm font-semibold text-void transition hover:shadow-glow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plasma"
    >
      <span className="sr-only md:not-sr-only">Create Customer</span>{' '}
      <PlusIcon className="h-5 md:ml-4" />
    </Link>
  );
}

export function UpdateCustomer({ id, name }: { id: string; name: string }) {
  return (
    <Link
      href={`/dashboard/customers/${id}/edit`}
      className="rounded-lg border border-line p-2 text-aura transition-colors hover:border-aura hover:text-white"
    >
      <span className="sr-only">Edit {name}</span>
      <PencilIcon className="w-5" />
    </Link>
  );
}

/**
 * Deletes the customer; the database refuses while they still have invoices, and
 * the reason shows next to the button.
 */
export function DeleteCustomer({ id, name }: { id: string; name: string }) {
  const initialState: CustomerState = { message: null };
  const [state, formAction, pending] = useActionState(deleteCustomer.bind(null, id), initialState);
  // The button is drawn twice (the phone list and the desktop table): a unique id each.
  const errorId = useId();

  return (
    <form action={formAction} className="flex flex-col items-end">
      <button
        type="submit"
        disabled={pending}
        aria-describedby={errorId}
        className="rounded-lg border border-line p-2 text-aura transition-colors hover:border-red-400 hover:text-red-400 disabled:opacity-50"
      >
        <span className="sr-only">Delete {name}</span>
        <TrashIcon className="w-5" />
      </button>
      <p
        id={errorId}
        aria-live="polite"
        className="mt-1 max-w-48 whitespace-normal text-right text-xs text-red-400"
      >
        {state.message}
      </p>
    </form>
  );
}
