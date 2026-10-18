import Image from 'next/image';

// Alien cats in suits, one antenna each like the mascot (public/xenocats/avatar-cat-1..5.svg).
const AVATARS = [1, 2, 3, 4, 5].map((n) => `/xenocats/avatar-cat-${n}.svg`);

/**
 * A customer's avatar, chosen from the name so a customer always gets the same
 * one. It replaced the course's stored images (the `image_url` column, no longer
 * written: migration 0012).
 */
export default function CustomerAvatar({ name, size = 28 }: { name: string; size?: number }) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return (
    <span
      className="flex flex-none items-center justify-center overflow-hidden rounded-full bg-avatar"
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
