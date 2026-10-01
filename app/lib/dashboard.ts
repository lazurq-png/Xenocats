// The dashboard's period logic and chart maths. Kept free of the database so it
// can be unit-tested; app/lib/data.ts runs the queries these describe.

export type Range = '12m' | 'all';

export const RANGES: { value: Range; label: string }[] = [
  { value: '12m', label: 'Last 12 months' },
  { value: 'all', label: 'All time' },
];

/** The range in the URL, defaulting to the last 12 months for anything unknown. */
export function parseRange(value: string | undefined): Range {
  return value === 'all' ? 'all' : '12m';
}

/** 'YYYY-MM' for a date, in UTC like the stored invoice dates. */
export function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** The first day ('YYYY-MM-DD') of the month `monthsBack` months before `now`'s. */
export function monthStart(now: Date, monthsBack: number): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsBack, 1));
  return d.toISOString().slice(0, 10);
}

/** The twelve calendar months ending with `now`'s, oldest first. */
export function lastTwelveMonths(now: Date): string[] {
  return Array.from({ length: 12 }, (_, i) =>
    monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11 + i, 1)))
  );
}

/** Percentage change from `previous` to `current`; null when there is nothing to compare with. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

/** '↗ 18.6%', '↘ 4.0%', or '—' when there is no earlier period to compare with. */
export function formatChange(change: number | null): string {
  if (change === null) return '—';
  return `${change >= 0 ? '↗' : '↘'} ${Math.abs(change).toFixed(1)}%`;
}

/**
 * The chart's top value and its y-axis ticks (both in cents, top first) for the
 * largest monthly total: `steps` evenly spaced round-dollar intervals.
 */
export function chartScale(maxCents: number, steps = 4): { top: number; ticks: number[] } {
  if (maxCents <= 0) return { top: 0, ticks: [0] };
  const rough = maxCents / 100 / steps;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rough)!;
  const stepCents = Math.round(step * 100);
  const top = Math.ceil(maxCents / stepCents) * stepCents;
  const ticks: number[] = [];
  for (let t = top; t >= 0; t -= stepCents) ticks.push(t);
  return { top, ticks };
}

/** An axis label: '$20K', '$2.5K', '$500', '$0'. */
export function formatAxis(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1000) return `$${+(dollars / 1000).toFixed(1)}K`;
  return `$${+dollars.toFixed(2)}`;
}

/** 'Jul' for 'YYYY-MM', or "Jul '26" when the chart spans several years. */
export function monthLabel(key: string, withYear: boolean): string {
  const [year, month] = key.split('-').map(Number);
  const name = new Date(Date.UTC(year, month - 1, 1)).toLocaleString('en-US', {
    month: 'short',
    timeZone: 'UTC',
  });
  return withYear ? `${name} '${String(year).slice(2)}` : name;
}
