'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { AtSymbolIcon, UserCircleIcon } from '@heroicons/react/24/solid';
import { type CustomerState, createCustomer, updateCustomer } from '@/app/lib/actions';
import type { CustomerEdit } from '@/app/lib/definitions';
import { Button } from '@/app/ui/button';

/** Creates a customer, or edits `customer` when given one. */
export default function CustomerForm({ customer }: { customer?: CustomerEdit }) {
  const initialState: CustomerState = { message: null, errors: {} };
  const action = customer ? updateCustomer.bind(null, customer.id) : createCustomer;
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction}>
      <div data-xenocat-frame className="rounded-2xl border border-line bg-panel p-4 md:p-6">
        <div className="mb-4">
          <label htmlFor="name" className="mb-2 block text-sm font-medium text-white">
            Name
          </label>
          <div className="relative">
            <input
              id="name"
              name="name"
              type="text"
              defaultValue={customer?.name}
              placeholder="The customer's name"
              autoComplete="off"
              className="peer block w-full rounded-xl border border-line bg-void/70 py-2.5 pl-10 text-sm text-white placeholder:text-aura/60 focus:border-aura focus:ring-aura"
              aria-describedby="name-error"
            />
            <UserCircleIcon className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-aura peer-focus:text-plasma" />
          </div>
          <div id="name-error" aria-live="polite" aria-atomic="true">
            {state.errors?.name?.map((error: string) => (
              <p className="mt-2 text-sm text-red-400" key={error}>
                {error}
              </p>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="email" className="mb-2 block text-sm font-medium text-white">
            Email
          </label>
          <div className="relative">
            <input
              id="email"
              name="email"
              type="email"
              defaultValue={customer?.email}
              placeholder="name@example.com"
              autoComplete="off"
              className="peer block w-full rounded-xl border border-line bg-void/70 py-2.5 pl-10 text-sm text-white placeholder:text-aura/60 focus:border-aura focus:ring-aura"
              aria-describedby="email-error"
            />
            <AtSymbolIcon className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-aura peer-focus:text-plasma" />
          </div>
          <div id="email-error" aria-live="polite" aria-atomic="true">
            {state.errors?.email?.map((error: string) => (
              <p className="mt-2 text-sm text-red-400" key={error}>
                {error}
              </p>
            ))}
          </div>
        </div>

        <div aria-live="polite" aria-atomic="true">
          {state.message && <p className="mt-4 text-sm text-red-400">{state.message}</p>}
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-4">
        <Link
          href="/dashboard/customers"
          className="flex h-10 items-center rounded-xl border border-line px-4 text-sm font-medium text-aura transition-colors hover:bg-panel hover:text-white"
        >
          Cancel
        </Link>
        <Button type="submit">{customer ? 'Save Customer' : 'Create Customer'}</Button>
      </div>
    </form>
  );
}
