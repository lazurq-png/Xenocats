import { Metadata } from 'next';
import Link from 'next/link';
import XenocatLogo from '@/app/ui/xenocat-logo';
import FightPage from '@/app/ui/xenocats/fight-page';

export const metadata: Metadata = {
  title: 'Survival',
};

export default function Page() {
  return (
    <div className="xenocat-stars min-h-screen bg-void-landing">
      <a
        href="#main-content"
        className="sr-only rounded-xl bg-plasma px-4 py-2 font-semibold text-void focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[10000]"
      >
        Skip to main content
      </a>
      <main className="mx-auto max-w-[1366px] px-6 pb-12 pt-4 md:px-12">
        <header className="mb-12 flex items-center justify-between gap-4">
          <Link href="/" aria-label="Xenocat Analytics home">
            <XenocatLogo />
          </Link>
          <Link
            href="/cats"
            className="border-b-2 border-aura-link/70 pb-1 text-[16.5px] font-semibold text-aura-link transition hover:border-aura hover:text-aura"
          >
            Back to the cats
          </Link>
        </header>
        <div id="main-content" tabIndex={-1} className="focus-visible:outline-none">
          <FightPage kind="survival" />
        </div>
      </main>
    </div>
  );
}
