import Link from 'next/link';
import { FaceFrownIcon } from '@heroicons/react/24/solid';

export default function NotFound() {
  return (
    <main className="flex h-full flex-col items-center justify-center gap-2">
      <FaceFrownIcon className="w-10 text-aura" />
      <h2 className="text-xl font-semibold text-white">404 Not Found</h2>
      <p className="text-aura">Could not find the requested invoice.</p>
      <Link
        href="/dashboard/invoices"
        className="mt-4 rounded-xl bg-plasma px-4 py-2 text-sm font-semibold text-void transition hover:shadow-glow"
      >
        Go Back
      </Link>
    </main>
  );
}
