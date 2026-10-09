import Image from 'next/image';
import { fetchMonthlyTotals } from '@/app/lib/data';
import { currentUserId } from '@/app/lib/session';
import { RANGES, Range, chartScale, formatAxis, monthLabel } from '@/app/lib/dashboard';
import { formatCurrency } from '@/app/lib/utils';

const CHART_HEIGHT = 225;

/** Collected (lime) under pending (violet) invoice totals per month, as in the mockup. */
export default async function RevenueChart({ range }: { range: Range }) {
  const months = await fetchMonthlyTotals(await currentUserId(), range);
  const { top, ticks } = chartScale(Math.max(0, ...months.map((m) => m.paid + m.pending)));
  // All time can span years; the last 12 months read fine as month names, as in the mockup.
  const withYear = range === 'all' && new Set(months.map((m) => m.month.slice(0, 4))).size > 1;
  const periodLabel = RANGES.find((r) => r.value === range)!.label;

  return (
    <div data-xenocat-frame className="relative rounded-2xl border border-line bg-panel p-5">
      {/* a cat peering over the panel's top edge */}
      <Image
        src="/xenocats/cat-peek.webp"
        alt=""
        width={114}
        height={113}
        className="pointer-events-none absolute -top-[17px] left-1/2 hidden w-[114px] -translate-x-1/2 sm:block"
      />
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-[18.9px] font-bold text-white">Revenue</h2>
          <p className="text-[12.2px] text-aura">{periodLabel}</p>
        </div>
        <ul className="space-y-1 text-[12.7px] text-aura">
          <li className="flex items-center gap-2">
            <span className="h-3.5 w-3.5 rounded-full bg-plasma" /> Collected
          </li>
          <li className="flex items-center gap-2">
            <span className="h-3.5 w-3.5 rounded-full bg-aura" /> Pending
          </li>
        </ul>
      </div>

      {top === 0 ? (
        <p
          className="mt-6 flex items-center justify-center text-sm text-aura"
          style={{ height: CHART_HEIGHT }}
        >
          No invoices in this period.
        </p>
      ) : (
        <div className="mt-6 flex gap-3" aria-hidden="true">
          <div
            className="flex flex-col justify-between text-right text-[11px] text-aura"
            style={{ height: CHART_HEIGHT }}
          >
            {ticks.map((tick) => (
              <span
                key={tick}
                className="-translate-y-1/2 leading-none first:translate-y-0 last:translate-y-0"
              >
                {formatAxis(tick)}
              </span>
            ))}
          </div>
          <div className="flex min-w-0 grow items-end justify-between gap-1.5 sm:gap-3">
            {months.map((m) => {
              const total = m.paid + m.pending;
              return (
                <div key={m.month} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                  <div
                    className="flex w-full max-w-[26px] flex-col justify-end"
                    style={{ height: CHART_HEIGHT }}
                    title={`${monthLabel(m.month, true)}: ${formatCurrency(m.paid)} collected, ${formatCurrency(m.pending)} pending`}
                  >
                    {total > 0 && (
                      <div
                        className="flex flex-col overflow-hidden rounded-t-[4px]"
                        style={{ height: `${(total / top) * 100}%`, minHeight: 2 }}
                      >
                        <div
                          className="bg-aura"
                          style={{ height: `${(m.pending / total) * 100}%` }}
                        />
                        <div className="grow bg-plasma" />
                      </div>
                    )}
                  </div>
                  {/* the year, when shown, goes on its own line so narrow columns still fit */}
                  <span className="flex flex-col items-center text-[11px] leading-tight text-aura sm:text-[12px]">
                    {monthLabel(m.month, withYear)
                      .split(' ')
                      .map((part) => (
                        <span key={part}>{part}</span>
                      ))}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="sr-only">
        <table>
          <caption>
            Collected and pending invoice totals per month, {periodLabel.toLowerCase()}
          </caption>
          <thead>
            <tr>
              <th scope="col">Month</th>
              <th scope="col">Collected</th>
              <th scope="col">Pending</th>
            </tr>
          </thead>
          <tbody>
            {months.map((m) => (
              <tr key={m.month}>
                <th scope="row">{monthLabel(m.month, true)}</th>
                <td>{formatCurrency(m.paid)}</td>
                <td>{formatCurrency(m.pending)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
