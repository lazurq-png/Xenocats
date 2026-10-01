'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex h-full flex-col items-center justify-center">
      <h2 className="text-center text-lg font-semibold text-white">Something went wrong!</h2>
      <button
        className="mt-4 rounded-xl bg-plasma px-4 py-2 text-sm font-semibold text-void transition hover:shadow-glow"
        onClick={() => reset()}
      >
        Try again
      </button>
    </main>
  );
}
