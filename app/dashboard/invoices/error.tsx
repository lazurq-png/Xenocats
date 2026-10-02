'use client';

import CatError from '@/app/ui/cat-error';

export default function Error(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <CatError {...props} />;
}
