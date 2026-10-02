'use client';

import { useActionState } from 'react';
import { KeyIcon } from '@heroicons/react/24/solid';
import clsx from 'clsx';
import { type PasswordState, changePassword } from '@/app/lib/actions';
import { Button } from '@/app/ui/button';

const fields = [
  { name: 'currentPassword', label: 'Current password', autoComplete: 'current-password' },
  { name: 'newPassword', label: 'New password', autoComplete: 'new-password' },
  { name: 'confirmPassword', label: 'Confirm new password', autoComplete: 'new-password' },
] as const;

/** Changes the logged-in user's password; each field's error is shown beside it. */
export default function PasswordForm() {
  const initialState: PasswordState = { message: null, errors: {} };
  const [state, formAction, isPending] = useActionState(changePassword, initialState);

  return (
    <form action={formAction}>
      <div data-xenocat-frame className="rounded-2xl border border-line bg-panel p-4 md:p-6">
        {fields.map((field) => (
          <div key={field.name} className="mb-4 last:mb-0">
            <label htmlFor={field.name} className="mb-2 block text-sm font-medium text-white">
              {field.label}
            </label>
            <div className="relative">
              <input
                id={field.name}
                name={field.name}
                type="password"
                autoComplete={field.autoComplete}
                className="peer block w-full rounded-xl border border-line bg-void/70 py-2.5 pl-10 text-sm text-white placeholder:text-aura/60 focus:border-aura focus:ring-aura"
                aria-describedby={`${field.name}-error`}
              />
              <KeyIcon className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-aura peer-focus:text-plasma" />
            </div>
            <div id={`${field.name}-error`} aria-live="polite" aria-atomic="true">
              {state.errors?.[field.name]?.map((error: string) => (
                <p className="mt-2 text-sm text-red-400" key={error}>
                  {error}
                </p>
              ))}
            </div>
          </div>
        ))}

        <div aria-live="polite" aria-atomic="true">
          {state.message && (
            <p className={clsx('mt-4 text-sm', state.done ? 'text-plasma' : 'text-red-400')}>
              {state.message}
            </p>
          )}
        </div>
      </div>
      <div className="mt-6 flex justify-end">
        <Button type="submit" aria-disabled={isPending}>
          Change Password
        </Button>
      </div>
    </form>
  );
}
