import Image from 'next/image';

// The mockup's planet-and-symbol avatars (public/xenocats/avatar-1..5.webp).
const AVATARS = [1, 2, 3, 4, 5].map((n) => `/xenocats/avatar-${n}.webp`);

/**
 * A customer's avatar, chosen from the name so a customer always gets the same
 * one. It stands in for the stored `image_url`, whose files belonged to the
 * course this app started from.
 */
export default function CustomerAvatar({ name, size = 28 }: { name: string; size?: number }) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return (
    <span
      className="flex flex-none items-center justify-center overflow-hidden rounded-full bg-[#1a1c3a]"
      style={{ width: size, height: size }}
    >
      <Image
        src={AVATARS[hash % AVATARS.length]}
        alt={`${name}'s avatar`}
        width={size}
        height={size}
        className="h-full w-full object-contain"
      />
    </span>
  );
}
