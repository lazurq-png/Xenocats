import Image from 'next/image';

/**
 * The landing page's hero art from the mockup: a dashboard circled by a glowing
 * orbit, with an alien cat asleep on top and the lime tip of its antenna floating
 * above. Positions are the mockup's element boxes, as percentages of the group.
 */
export default function HomeHero() {
  return (
    <div
      role="img"
      aria-label="The Xenocat Analytics dashboard, circled by an orbit, with an alien cat asleep on top of it"
      className="relative mx-auto aspect-[847/721] w-full max-w-[847px] select-none"
    >
      {/* the violet glow the art sits in */}
      <div className="absolute left-[14%] top-[30%] h-[62%] w-[74%] rounded-[40%] bg-aura/25 blur-3xl" />
      <Image
        src="/xenocats/hero-orbit-ring.webp"
        alt=""
        width={1694}
        height={834}
        priority
        className="absolute left-0 top-[28.7%] h-[57.8%] w-full"
      />
      <Image
        src="/xenocats/hero-dashboard.webp"
        alt=""
        width={1400}
        height={1090}
        priority
        className="absolute left-[9.56%] top-[24.4%] h-[75.6%] w-[82.6%]"
      />
      <Image
        src="/xenocats/cat-sleeping.webp"
        alt=""
        width={1173}
        height={481}
        priority
        className="absolute left-[19.1%] top-0 h-[33.3%] w-[69.2%]"
      />
      {/* the antenna's glowing tip */}
      <span className="absolute left-[27%] top-[3%] aspect-square w-[3.4%] rounded-full bg-plasma shadow-[0_0_18px_4px_rgba(193,232,56,0.7)]" />
    </div>
  );
}
