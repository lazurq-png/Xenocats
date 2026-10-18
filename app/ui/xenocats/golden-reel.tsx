'use client';

import { useEffect, useState } from 'react';

/** A golden chest's reel spins this long, then shows what it landed on this long. */
export const REEL_SPIN_MS = 1400;
export const REEL_HOLD_MS = 900;

/**
 * A golden chest's reel: 1, 3 and 5 spin by, slowing, until it lands on what the chest
 * holds, and then says how many of those he gets: `picks`, fewer when he has too little
 * left to upgrade. It only shows; the run waits for it (the loop holds it).
 */
export function GoldenReel({ rewards, picks }: { rewards: number; picks: number }) {
  const [shown, setShown] = useState(1);
  const [landed, setLanded] = useState(false);
  useEffect(() => {
    const faces = [1, 3, 5];
    let turn = 0;
    let timer = 0;
    const started = performance.now();
    const spin = () => {
      const spent = performance.now() - started;
      if (spent >= REEL_SPIN_MS) {
        setShown(rewards);
        setLanded(true);
        return;
      }
      setShown(faces[turn++ % faces.length]);
      // Slower as it goes, as a reel does.
      timer = window.setTimeout(spin, 60 + (spent / REEL_SPIN_MS) * 220);
    };
    spin();
    return () => window.clearTimeout(timer);
  }, [rewards]);
  return (
    <div
      data-testid="survival-golden-reel"
      data-rewards={rewards}
      data-picks={picks}
      className="pointer-events-none absolute inset-x-0 top-1/3 flex justify-center px-4"
    >
      <div className="rounded-2xl border-2 border-tier-8 bg-panel/90 px-8 py-5 text-center">
        <p className="font-display text-lg font-semibold text-tier-8">Golden chest</p>
        <p
          aria-hidden="true"
          className={`mt-2 font-display text-5xl font-semibold ${landed ? 'text-tier-8' : 'text-cream'}`}
        >
          {shown}
        </p>
        <p role="status" className="mt-2 text-sm text-cream">
          {landed ? landedText(rewards, picks) : ''}
        </p>
      </div>
    </div>
  );
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** What the reel says once it has landed. */
function landedText(rewards: number, picks: number): string {
  const held = count(rewards, 'reward', 'rewards');
  if (picks >= rewards) return held;
  if (picks === 0) return `${held}, but nothing is left to upgrade`;
  return `${held}, but only ${count(picks, 'upgrade is', 'upgrades are')} left`;
}
