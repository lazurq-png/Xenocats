import { Metadata } from 'next';
import XenocatLogo from '@/app/ui/xenocat-logo';
import SignUpForm from '@/app/ui/signup-form';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Create an account',
};

/** Making an account, laid out as the login page is. */
export default function SignUpPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-void-login bg-[url('/xenocats/bg-login.webp')] bg-cover bg-center px-4 py-10">
      <Link href="/" aria-label="Xenocat Analytics home" className="mb-16 md:mb-[80px]">
        <XenocatLogo variant="login" />
      </Link>
      <div className="w-full max-w-[550px]">
        <SignUpForm />
      </div>
    </main>
  );
}
