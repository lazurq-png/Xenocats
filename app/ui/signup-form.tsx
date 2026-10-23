'use client';

import { ExclamationCircleIcon, LockClosedIcon, UserIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useActionState } from 'react';
import { signUp, type SignUpState } from '@/app/lib/actions';
import { loginCardClass, loginIconClass, loginInputClass } from '@/app/ui/login-styles';

const labelClass = 'mb-2 mt-6 block text-[13.2px] font-semibold text-white';

/** A field's errors, in the region its input names with aria-describedby. */
function FieldErrors({ id, errors }: { id: string; errors?: string[] }) {
  return (
    <div id={id} aria-live="polite" aria-atomic="true">
      {errors?.map((error) => (
        <p className="mt-2 text-sm text-red-400" key={error}>
          {error}
        </p>
      ))}
    </div>
  );
}

/** Making an account: a username and a password, no email. */
export default function SignUpForm() {
  const initialState: SignUpState = { message: null, errors: {} };
  const [state, formAction, isPending] = useActionState(signUp, initialState);

  return (
    <form action={formAction} className={loginCardClass}>
      <h1 className="font-display text-[30px] font-semibold leading-[0.95] text-white sm:text-[40.8px]">
        Join the <br />
        <span className="text-aura-login">stargazers</span>
        <span className="text-plasma">.</span>
      </h1>

      <label className={`${labelClass} mt-9`} htmlFor="username">
        Username
      </label>
      <div className="relative">
        <input
          className={loginInputClass}
          id="username"
          type="text"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          placeholder="3 to 20 letters, digits, _ or -"
          required
          minLength={3}
          maxLength={20}
          pattern="[A-Za-z0-9_\-]{3,20}"
          aria-describedby="username-error"
        />
        <UserIcon className={loginIconClass} />
      </div>
      <FieldErrors id="username-error" errors={state.errors?.username} />

      <label className={labelClass} htmlFor="password">
        Password
      </label>
      <div className="relative">
        <input
          className={loginInputClass}
          id="password"
          type="password"
          name="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          required
          minLength={8}
          aria-describedby="password-error"
        />
        <LockClosedIcon className={loginIconClass} />
      </div>
      <FieldErrors id="password-error" errors={state.errors?.password} />

      <label className={labelClass} htmlFor="confirmPassword">
        Password again
      </label>
      <div className="relative">
        <input
          className={loginInputClass}
          id="confirmPassword"
          type="password"
          name="confirmPassword"
          autoComplete="new-password"
          placeholder="Type it once more"
          required
          aria-describedby="confirmPassword-error"
        />
        <LockClosedIcon className={loginIconClass} />
      </div>
      <FieldErrors id="confirmPassword-error" errors={state.errors?.confirmPassword} />

      <button
        className="mt-7 flex h-[46px] w-full items-center justify-center rounded-lg bg-plasma text-[17px] font-bold text-black shadow-glow transition hover:bg-plasma-dim focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plasma aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
        aria-disabled={isPending}
      >
        Create account
      </button>
      <div className="flex min-h-8 items-end gap-1" aria-live="polite" aria-atomic="true">
        {state.message && (
          <>
            <ExclamationCircleIcon className="h-5 w-5 text-red-400" />
            <p className="text-sm text-red-400">{state.message}</p>
          </>
        )}
      </div>
      <p className="mt-2 text-sm text-aura-login">
        Already have an account?{' '}
        <Link
          href="/login"
          className="tap-area font-semibold text-white underline hover:text-plasma"
        >
          Log in
        </Link>
      </p>
    </form>
  );
}
