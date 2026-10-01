import XenocatLogo from '@/app/ui/xenocat-logo';
import HomeHero from '@/app/ui/home-hero';
import { ArrowRightIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';
import Link from 'next/link';

/** The landing page, laid out after the mockup's third page (1366×768). */
export default function Page() {
  return (
    <div className="xenocat-stars relative min-h-screen overflow-x-clip bg-void-landing">
      <div className="relative mx-auto flex min-h-screen max-w-[1366px] flex-col px-6 md:px-12">
        <header className="flex items-center justify-between gap-4 pt-4">
          <Link href="/" aria-label="Xenocat Analytics home">
            <XenocatLogo variant="landing" />
          </Link>
          <nav aria-label="Main" className="flex items-center gap-6">
            <Link
              href="/login"
              className="shrink-0 whitespace-nowrap rounded-full bg-plasma px-5 py-2.5 text-[15px] sm:px-7 sm:py-3 font-semibold text-black shadow-glow transition hover:bg-plasma-dim focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-plasma"
            >
              Log in
            </Link>
            <Link
              href="/cats"
              className="hidden border-b-2 border-aura-link/70 pb-1 text-[16.5px] font-semibold text-aura-link transition hover:border-aura hover:text-aura sm:inline"
            >
              Meet the cats
            </Link>
          </nav>
        </header>

        <main className="flex grow flex-col items-center gap-14 pb-16 pt-14 lg:flex-row lg:items-start lg:gap-0 lg:pb-0 lg:pt-[60px]">
          <div className="relative z-10 w-full lg:w-[36%] lg:shrink-0 lg:pt-[20px]">
            <h1 className="font-display text-[40px] font-semibold leading-[1.08] text-cream md:text-[52px]">
              Your invoices and customers <span className="text-plasma">at a glance —</span>
              <span className="mt-1 block font-sans text-[30px] font-medium leading-[1.18] text-white md:text-[40.6px]">
                with a few alien cats keeping watch.
              </span>
            </h1>
            <div className="mt-8 flex flex-wrap items-center gap-8">
              <Link
                href="/login"
                className="flex h-[68px] w-[250px] items-center justify-between rounded-2xl bg-plasma px-16 pr-6 text-[20.8px] font-semibold text-black shadow-glow transition hover:bg-plasma-dim focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-plasma"
              >
                <span>Log in</span>
                <ArrowRightIcon className="w-7" aria-hidden="true" />
              </Link>
              <Link
                href="/cats"
                className="border-b-2 border-aura-link/70 pb-1 text-[20.8px] font-semibold text-aura-link transition hover:border-aura hover:text-aura"
              >
                Meet the cats
              </Link>
            </div>
          </div>
          <div className="w-full lg:-mt-[128px] lg:ml-auto lg:w-[62%]">
            <HomeHero />
          </div>
        </main>
      </div>
      {/* the orbiting cat in the bottom-left corner */}
      <Image
        src="/xenocats/orbit-cat.webp"
        alt=""
        width={456}
        height={176}
        className="pointer-events-none absolute bottom-0 left-0 hidden w-[33%] max-w-[456px] lg:block"
      />
    </div>
  );
}
