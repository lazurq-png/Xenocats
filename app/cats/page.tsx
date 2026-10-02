import { Metadata } from 'next';
import Link from 'next/link';
import XenocatLogo from '@/app/ui/xenocat-logo';
import CatGallery from '@/app/ui/xenocats/cat-gallery';

export const metadata: Metadata = {
  title: 'Cats',
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
            href="/dashboard"
            className="border-b-2 border-aura-link/70 pb-1 text-[16.5px] font-semibold text-aura-link transition hover:border-aura hover:text-aura"
          >
            Back to the dashboard
          </Link>
        </header>
        {/* The skip link's target: past the header's links, to the cats. */}
        <div id="main-content" tabIndex={-1} className="mb-6 focus-visible:outline-none">
          <h1 className="font-display text-4xl font-semibold text-cream md:text-[52px]">
            The <span className="text-plasma">cats</span>
          </h1>
          <p className="mt-4 max-w-2xl text-lg font-medium text-white">
            Every alien cat that haunts the dashboard, and what it does to your cursor. Summon one
            to try it.
          </p>
        </div>
        <CatGallery />
      </main>
    </div>
  );
}
