import { lusitana } from '@/app/ui/fonts';

/** The Xenocat Analytics mark: an alien cat's head with its antenna, in currentColor. */
export function XenocatMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path d="M24 8 Q23 4 26 1.8" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="26.5" cy="2.6" r="2.4" fill="currentColor" />
      <path
        d="M8 43 C4 36 5 27 9 21 L7 7 L17 14 C19.5 13 22 12.6 24 12.6 C26 12.6 28.5 13 31 14 L41 7 L39 21 C43 27 44 36 40 43 Z"
        fill="currentColor"
      />
      {/* eyes and nose cut out of the head */}
      <path
        d="M14.5 28 C15.5 24 20 23.5 21.5 27.5 C19.5 30.5 16 31 14.5 28 Z M33.5 28 C32.5 24 28 23.5 26.5 27.5 C28.5 30.5 32 31 33.5 28 Z M22.2 34 H25.8 L24 36.2 Z"
        fill="#1e3a8a"
      />
    </svg>
  );
}

/** The full logo, white, for the blue panels of the home, login and dashboard pages. */
export default function XenocatLogo() {
  return (
    <div
      className={`${lusitana.className} flex flex-row items-center gap-2 leading-none text-white`}
    >
      <XenocatMark className="h-11 w-11 flex-none" />
      <p className="flex flex-col">
        <span className="text-[30px] tracking-tight">Xenocat</span>
        <span className="mt-1 font-sans text-[11px] font-medium uppercase tracking-[0.3em] text-blue-100">
          Analytics
        </span>
      </p>
    </div>
  );
}
