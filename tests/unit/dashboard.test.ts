import { describe, expect, it } from 'vitest';
import {
  chartScale,
  formatAxis,
  formatChange,
  lastTwelveMonths,
  monthLabel,
  monthStart,
  parseRange,
  percentChange,
} from '@/app/lib/dashboard';

const now = new Date('2026-09-30T12:00:00Z');

describe('parseRange', () => {
  it('reads "12m" and defaults everything else to all time', () => {
    expect(parseRange('all')).toBe('all');
    expect(parseRange('12m')).toBe('12m');
    expect(parseRange(undefined)).toBe('all');
    expect(parseRange('forever')).toBe('all');
  });
});

describe('month windows', () => {
  it('lists the twelve months ending with the current one, oldest first', () => {
    const months = lastTwelveMonths(now);
    expect(months).toHaveLength(12);
    expect(months[0]).toBe('2025-10');
    expect(months[11]).toBe('2026-09');
  });

  it('crosses year boundaries', () => {
    expect(lastTwelveMonths(new Date('2026-01-15T00:00:00Z'))[0]).toBe('2025-02');
  });

  it('gives the first day of the window and of the one before it', () => {
    expect(monthStart(now, 11)).toBe('2025-10-01');
    expect(monthStart(now, 23)).toBe('2024-10-01');
  });
});

describe('percentChange and formatChange', () => {
  it('computes the change from the previous period', () => {
    expect(percentChange(120, 100)).toBeCloseTo(20);
    expect(percentChange(50, 100)).toBeCloseTo(-50);
  });

  it('has nothing to compare with when the previous period was empty', () => {
    expect(percentChange(500, 0)).toBeNull();
    expect(formatChange(null)).toBe('—');
  });

  it('formats growth and decline with an arrow and one decimal', () => {
    expect(formatChange(18.6)).toBe('↗ 18.6%');
    expect(formatChange(0)).toBe('↗ 0.0%');
    expect(formatChange(-4)).toBe('↘ 4.0%');
  });
});

describe('chartScale', () => {
  it('rounds the top up to a whole number of even steps', () => {
    // $18,000 in four steps -> $5,000 steps, top $20,000
    expect(chartScale(1_800_000)).toEqual({
      top: 2_000_000,
      ticks: [2_000_000, 1_500_000, 1_000_000, 500_000, 0],
    });
  });

  it('scales down to small amounts', () => {
    // $7.77 in four steps is ~$1.94 each -> $2 steps, top $8
    expect(chartScale(777)).toEqual({ top: 800, ticks: [800, 600, 400, 200, 0] });
  });

  it('has a single zero tick for an empty chart', () => {
    expect(chartScale(0)).toEqual({ top: 0, ticks: [0] });
  });
});

describe('formatAxis', () => {
  it('abbreviates thousands', () => {
    expect(formatAxis(2_000_000)).toBe('$20K');
    expect(formatAxis(250_000)).toBe('$2.5K');
    expect(formatAxis(50_000)).toBe('$500');
    expect(formatAxis(250)).toBe('$2.5');
    expect(formatAxis(0)).toBe('$0');
  });
});

describe('monthLabel', () => {
  it('names the month, with the year when asked', () => {
    expect(monthLabel('2026-07', false)).toBe('Jul');
    expect(monthLabel('2022-06', true)).toBe("Jun '22");
  });
});
