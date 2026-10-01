'use client';

import {
  EnvelopeIcon,
  EyeIcon,
  EyeSlashIcon,
  LockClosedIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import { useActionState, useState } from 'react';
import { authenticate } from '@/app/lib/actions';
import { useSearchParams } from 'next/navigation';

const inputClass =
  'peer block h-[46px] w-full rounded-lg border border-[#2d3052] bg-[#070d22] pl-12 text-[13.2px] font-medium text-white placeholder:text-aura-login focus:border-aura-login focus:ring-aura-login';
const iconClass =
  'pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-aura-login';

export default function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
  const [errorMessage, formAction, isPending] = useActionState(authenticate, undefined);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form
      action={formAction}
      className="rounded-2xl border border-[#2d3052] bg-[#050e20] px-6 pb-8 pt-10 shadow-halo sm:px-[55px]"
    >
      <h1 className="font-display text-[30px] font-semibold leading-[0.95] text-white sm:text-[40.8px]">
        Welcome back, <br />
        <span className="text-aura-login">stargazer</span>
        <span className="text-plasma">.</span>
      </h1>

      <label className="mb-2 mt-9 block text-[13.2px] font-semibold text-white" htmlFor="email">
        Email
      </label>
      <div className="relative">
        <input
          className={inputClass}
          id="email"
          type="email"
          name="email"
          placeholder="you@example.com"
          required
        />
        <EnvelopeIcon className={iconClass} />
      </div>

      <label className="mb-2 mt-6 block text-[13.9px] font-semibold text-white" htmlFor="password">
        Password
      </label>
      <div className="relative">
        <input
          className={`${inputClass} pr-12`}
          id="password"
          type={showPassword ? 'text' : 'password'}
          name="password"
          placeholder="Enter password"
          required
          minLength={6}
        />
        <LockClosedIcon className={iconClass} />
        <button
          type="button"
          onClick={() => setShowPassword((shown) => !shown)}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          aria-pressed={showPassword}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-aura-login transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-aura-login"
        >
          {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
        </button>
      </div>

      <input type="hidden" name="redirectTo" value={callbackUrl} />
      <button
        className="mt-7 flex h-[46px] w-full items-center justify-center rounded-lg bg-plasma text-[17px] font-bold text-black shadow-glow transition hover:bg-plasma-dim focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plasma aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
        aria-disabled={isPending}
      >
        Log in
      </button>
      <div className="flex min-h-8 items-end gap-1" aria-live="polite" aria-atomic="true">
        {errorMessage && (
          <>
            <ExclamationCircleIcon className="h-5 w-5 text-red-400" />
            <p className="text-sm text-red-400">{errorMessage}</p>
          </>
        )}
      </div>
    </form>
  );
}
