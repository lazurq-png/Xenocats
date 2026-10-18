'use client';

import {
  UserIcon,
  EyeIcon,
  EyeSlashIcon,
  LockClosedIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import { useActionState, useState } from 'react';
import { authenticate } from '@/app/lib/actions';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { loginCardClass, loginIconClass, loginInputClass } from '@/app/ui/login-styles';

export default function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
  // Signed out everywhere by a password change (changePassword).
  const passwordChanged = searchParams.has('password-changed');
  const [errorMessage, formAction, isPending] = useActionState(authenticate, undefined);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className={loginCardClass}>
      <h1 className="font-display text-[30px] font-semibold leading-[0.95] text-white sm:text-[40.8px]">
        Welcome back, <br />
        <span className="text-aura-login">stargazer</span>
        <span className="text-plasma">.</span>
      </h1>
      {passwordChanged && (
        <p role="status" className="mt-4 text-sm text-plasma">
          Your password was changed and you were signed out everywhere. Log in with your new
          password.
        </p>
      )}

      <label className="mb-2 mt-9 block text-[13.2px] font-semibold text-white" htmlFor="login">
        Username or email
      </label>
      <div className="relative">
        <input
          className={loginInputClass}
          id="login"
          type="text"
          name="login"
          autoComplete="username"
          autoCapitalize="none"
          placeholder="Your username"
          required
        />
        <UserIcon className={loginIconClass} />
      </div>

      <label className="mb-2 mt-6 block text-[13.9px] font-semibold text-white" htmlFor="password">
        Password
      </label>
      <div className="relative">
        <input
          className={`${loginInputClass} pr-12`}
          id="password"
          type={showPassword ? 'text' : 'password'}
          name="password"
          placeholder="Enter password"
          required
          minLength={6}
          autoComplete="current-password"
        />
        <LockClosedIcon className={loginIconClass} />
        <button
          type="button"
          onClick={() => setShowPassword((shown) => !shown)}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          aria-pressed={showPassword}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-sm p-1 text-aura-login transition hover:text-white focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-aura-login"
        >
          {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
        </button>
      </div>

      <input type="hidden" name="redirectTo" value={callbackUrl} />
      <button
        className="mt-7 flex h-[46px] w-full items-center justify-center rounded-lg bg-plasma text-[17px] font-bold text-black shadow-glow transition hover:bg-plasma-dim focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plasma aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
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
      <p className="mt-2 text-sm text-aura-login">
        New here?{' '}
        <Link href="/signup" className="font-semibold text-white underline hover:text-plasma">
          Create an account
        </Link>
      </p>
    </form>
  );
}
