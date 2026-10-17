import { Metadata } from 'next';
import Link from 'next/link';
import XenocatLogo from '@/app/ui/xenocat-logo';
import BackLink from '@/app/ui/back-link';
import FightPage from '@/app/ui/xenocats/fight-page';
import { auth } from '@/auth';

export const metadata: Metadata = {
  title: 'Survival',
};

export default async function Page() {
  // Open to everyone; a signed-in player can put a run on the leaderboard.
  const signedIn = !!(await auth())?.user?.id;
  return (
    <div className="xenocat-stars min-h-screen bg-void-landing">
      <a
        href="#main-content"
        className="sr-only rounded-xl bg-plasma px-4 py-2 font-semibold text-void focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-10000"
      >
        Skip to main content
      </a>
      <main className="mx-auto max-w-[1366px] px-6 pb-12 pt-4 md:px-12">
        <header className="mb-12 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <Link href="/" aria-label="Xenocat Analytics home">
            <XenocatLogo />
          </Link>
          <BackLink href="/cats">Back to the cats</BackLink>
        </header>
        <div id="main-content" tabIndex={-1} className="focus-visible:outline-hidden">
          <FightPage signedIn={signedIn} />
        </div>
      </main>
    </div>
  );
}
