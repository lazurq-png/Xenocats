'use client';

import { useEffect } from 'react';
import CatState, { catStateLinkClass } from '@/app/ui/cat-state';

/** The dashboard's error state (each error.tsx renders it): logs, and offers a retry. */
export default function CatError({
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
    <div className="flex h-full flex-col items-center justify-center">
      <CatState
        art="peeking"
        title="Something went wrong!"
        as="h1"
        action={
          <button type="button" className={catStateLinkClass} onClick={() => reset()}>
            Try again
          </button>
        }
      >
        A cat got into the wiring. Try again; if it keeps happening, come back in a while.
      </CatState>
    </div>
  );
}
