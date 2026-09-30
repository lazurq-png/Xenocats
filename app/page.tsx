import XenocatLogo from '@/app/ui/acme-logo';
import { ArrowRightIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { lusitana } from '@/app/ui/fonts';
import HomeHero from '@/app/ui/home-hero';

export default function Page() {
  return (
    <main className="flex min-h-screen flex-col p-6">
      <div className="flex h-20 shrink-0 items-end rounded-lg bg-blue-500 p-4 md:h-52">
        <XenocatLogo />
      </div>
      <div className="mt-4 flex grow flex-col gap-4 md:flex-row">
        <div className="flex flex-col justify-center gap-6 rounded-lg bg-gray-50 px-6 py-10 md:w-2/5 md:px-20">
          <p
            className={`${lusitana.className} text-xl text-gray-800 antialiased md:text-3xl md:leading-normal`}
          >
            <strong>Welcome to Xenocat Analytics.</strong> Your invoices and customers at a glance —
            with a few alien cats keeping watch.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/login"
              className="flex items-center gap-5 self-start rounded-lg bg-blue-500 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-400 md:text-base"
            >
              <span>Log in</span> <ArrowRightIcon className="w-5 md:w-6" />
            </Link>
            <Link
              href="/cats"
              className="text-sm font-medium text-blue-600 hover:text-blue-500 md:text-base"
            >
              Meet the cats
            </Link>
          </div>
        </div>
        <div className="flex items-center justify-center p-10 md:w-3/5 md:px-28 md:py-12">
          <HomeHero />
        </div>
      </div>
    </main>
  );
}
