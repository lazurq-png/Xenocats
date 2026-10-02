import { Metadata } from 'next';
import Link from 'next/link';
import CatState, { catStateLinkClass } from '@/app/ui/cat-state';
import XenocatLogo from '@/app/ui/xenocat-logo';

export const metadata: Metadata = {
  title: 'Not found',
};

/** Any address the app does not have, inside or outside the dashboard. */
export default function NotFound() {
  return (
    <main className="xenocat-stars flex min-h-screen flex-col items-center justify-center bg-void-landing px-4 py-10">
      <Link href="/" aria-label="Xenocat Analytics home" className="mb-10">
        <XenocatLogo />
      </Link>
      <CatState
        art="asleep"
        title="404 Not Found"
        as="h1"
        action={
          <Link href="/" className={catStateLinkClass}>
            Back to the home page
          </Link>
        }
      >
        This page has drifted off into space, and a cat has fallen asleep where it was.
      </CatState>
    </main>
  );
}
