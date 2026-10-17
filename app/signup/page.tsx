import { Metadata } from 'next';
import XenocatLogo from '@/app/ui/xenocat-logo';
import SignUpForm from '@/app/ui/signup-form';
import BackLink from '@/app/ui/back-link';
import Image from 'next/image';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Create an account',
};

/** Making an account, laid out as the login page is. */
export default function SignUpPage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-void-login bg-[url('/xenocats/bg-login.webp')] bg-cover bg-center px-4 pt-20 pb-10">
      <BackLink href="/" className="absolute left-4 top-6 md:left-12">
        Back to the home page
      </BackLink>
      <Link href="/" aria-label="Xenocat Analytics home" className="mb-16 md:mb-[80px]">
        <XenocatLogo variant="login" />
      </Link>
      <div className="relative w-full max-w-[550px]">
        {/* the lookout, paws over the card's top edge, as on the login page */}
        <Image
          src="/xenocats/cat-login-peek.webp"
          alt=""
          width={131}
          height={113}
          priority
          className="absolute top-[-96px] right-[30px] w-[131px]"
        />
        <SignUpForm />
      </div>
    </main>
  );
}
