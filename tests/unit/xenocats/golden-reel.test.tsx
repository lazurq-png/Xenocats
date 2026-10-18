// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GoldenReel, REEL_SPIN_MS } from '@/app/ui/xenocats/golden-reel';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('the golden chest’s reel', () => {
  it('spins, then lands on what the chest holds and says so', () => {
    vi.useFakeTimers();
    render(<GoldenReel rewards={3} />);
    expect(screen.getByText('Golden chest')).toBeTruthy();
    // Still spinning: nothing is announced yet.
    expect(screen.getByRole('status').textContent).toBe('');
    act(() => {
      vi.advanceTimersByTime(REEL_SPIN_MS + 400);
    });
    expect(screen.getByRole('status').textContent).toBe('3 rewards');
    expect(screen.getByTestId('survival-golden-reel').textContent).toContain('3');
  });

  it('one reward is said as one', () => {
    vi.useFakeTimers();
    render(<GoldenReel rewards={1} />);
    act(() => {
      vi.advanceTimersByTime(REEL_SPIN_MS + 400);
    });
    expect(screen.getByRole('status').textContent).toBe('1 reward');
  });
});
