import clsx from 'clsx';
import Image from 'next/image';

/**
 * The Xenocat Analytics logo in the mockup's three treatments:
 * - `landing`: the lime cat-and-orbit mark, "Xenocat" in white, "Analytics" in lime;
 * - `login`: the violet cat mark and a larger wordmark, "Analytics" in violet;
 * - `dashboard`: the stacked Orbitron wordmark of the sidebar.
 */
export default function XenocatLogo({
  variant = 'landing',
  className,
}: {
  variant?: 'landing' | 'login' | 'dashboard';
  className?: string;
}) {
  if (variant === 'dashboard') {
    return (
      <p className={clsx('flex flex-col items-center font-display leading-none', className)}>
        <span className="text-[26px] font-black uppercase tracking-wide text-plasma">Xenocat</span>
        <span className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.5em] text-aura">
          Analytics
        </span>
      </p>
    );
  }

  const login = variant === 'login';
  return (
    <div
      className={clsx('flex items-center', login ? 'gap-3 sm:gap-5' : 'gap-2 sm:gap-3', className)}
    >
      <Image
        src={login ? '/xenocats/logo-mark-violet.webp' : '/xenocats/logo-mark-lime.webp'}
        alt=""
        width={login ? 58 : 50}
        height={login ? 57 : 49}
        priority
      />
      <p
        className={clsx(
          'flex items-baseline',
          login ? 'gap-3 sm:gap-5' : 'gap-2 sm:gap-7 md:gap-12'
        )}
      >
        <span
          className={clsx(
            'text-white',
            login
              ? 'text-3xl font-bold md:text-[43px]'
              : 'text-xl font-semibold tracking-tight sm:text-2xl md:text-[27.6px]'
          )}
        >
          Xenocat
        </span>
        <span
          className={clsx(
            login
              ? 'text-2xl font-bold text-aura-login md:text-[35px]'
              : 'text-sm font-semibold tracking-tight text-plasma sm:text-base md:text-[19px]'
          )}
        >
          Analytics
        </span>
      </p>
    </div>
  );
}
