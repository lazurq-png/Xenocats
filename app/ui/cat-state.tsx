import Image from 'next/image';
import type { ReactNode } from 'react';

// The cats' own artwork for the dashboard's not-found, error and empty states.
// Decorative: the heading and the text carry the meaning, so the images are hidden
// from assistive technology like the rest of the cats.
const ART = {
  /** Not found: the page has drifted off, and a cat has fallen asleep in its place. */
  asleep: { src: '/xenocats/cat-sleeping.webp', width: 1173, height: 481, className: 'w-64' },
  /** Something went wrong: a cat peeks in to see what broke. */
  peeking: { src: '/xenocats/cat-login-peek.webp', width: 131, height: 113, className: 'w-24' },
  /** Nothing matched: a cat peers at the empty space. */
  empty: { src: '/xenocats/cat-peek.webp', width: 114, height: 113, className: 'w-20' },
} as const;

export default function CatState({
  art,
  title,
  children,
  action,
  as: Heading = 'h2',
}: {
  art: keyof typeof ART;
  title: string;
  /** What happened, in a sentence or two. */
  children: ReactNode;
  /** A link or button that leads on. */
  action?: ReactNode;
  /** h1 where the state is the whole page; h3 inside a card titled h2. */
  as?: 'h1' | 'h2' | 'h3';
}) {
  const image = ART[art];
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center">
      <Image
        src={image.src}
        alt=""
        aria-hidden
        width={image.width}
        height={image.height}
        className={`${image.className} pointer-events-none mb-2 h-auto`}
      />
      <Heading className="text-xl font-semibold text-white">{title}</Heading>
      <div className="max-w-md text-aura">{children}</div>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** The plasma button-link the states lead on with. */
export const catStateLinkClass =
  'rounded-xl bg-plasma px-4 py-2 text-sm font-semibold text-void transition hover:shadow-glow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plasma';
