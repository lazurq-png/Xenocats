import XenocatLogo from '@/app/ui/xenocat-logo';
import LoginForm from '@/app/ui/login-form';
import BackLink from '@/app/ui/back-link';
import Image from 'next/image';
import Link from 'next/link';
import { Suspense } from 'react';

/** The login page, laid out after the mockup's second page (1366×768). */
export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-void-login bg-[url('/xenocats/bg-login.webp')] bg-cover bg-center px-4 pt-20 pb-10">
      <BackLink href="/" className="absolute left-4 top-6 md:left-12">
        Back to the home page
      </BackLink>
      <Link href="/" aria-label="Xenocat Analytics home" className="mb-16 md:mb-[80px]">
        <XenocatLogo variant="login" />
      </Link>
      <div className="relative w-full max-w-[550px]">
        {/* the lookout, paws over the card's top edge */}
        <Image
          src="/xenocats/cat-login-peek.webp"
          alt=""
          width={131}
          height={113}
          priority
          className="absolute top-[-96px] right-[30px] w-[131px]"
        />
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
