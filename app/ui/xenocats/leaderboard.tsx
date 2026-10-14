import clsx from 'clsx';
import { connection } from 'next/server';
import { auth } from '@/auth';
import { fetchLeaderboard } from '@/app/lib/data';
import type { LeaderboardRow } from '@/app/lib/definitions';
import { RUN_LENGTHS, clockText } from './arena-storage';

/** The viewer's best run of a length, with its place; or that there is none yet. */
function PersonalBest({ minutes, best }: { minutes: number; best: LeaderboardRow | null }) {
  return (
    <p
      data-testid={`personal-best-${minutes}`}
      className="mt-4 border-t border-line pt-3 text-sm text-aura"
    >
      <span className="font-semibold text-cream">Your best: </span>
      {best ? (
        <>
          {clockText(best.time_ms)}, {best.sent_home} cats sent home, as{' '}
          <span className="font-semibold text-cream">{best.name}</span> (#{best.place})
        </>
      ) : (
        'no run of this length yet.'
      )}
    </p>
  );
}

/** One run length's board: each player's best run, longest first. */
function Board({
  minutes,
  rows,
  best,
  signedIn,
}: {
  minutes: number;
  rows: LeaderboardRow[];
  best: LeaderboardRow | null;
  signedIn: boolean;
}) {
  const heading = `leaderboard-${minutes}-heading`;
  return (
    <section
      aria-labelledby={heading}
      data-testid={`leaderboard-${minutes}`}
      className="rounded-2xl border border-line bg-panel p-5"
    >
      <h3 id={heading} className="font-display text-xl font-semibold text-cream">
        {minutes} minutes
      </h3>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-aura">No runs yet. Be the first.</p>
      ) : (
        <table className="mt-3 w-full text-left text-sm text-white">
          <thead className="text-aura">
            <tr>
              <th scope="col" className="py-1 pr-2 font-semibold">
                #
              </th>
              <th scope="col" className="py-1 pr-2 font-semibold">
                Name
              </th>
              <th scope="col" className="py-1 pr-2 text-right font-semibold">
                Time
              </th>
              <th scope="col" className="py-1 text-right font-semibold">
                Cats
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.place}
                aria-current={row.mine || undefined}
                className={clsx('border-t border-line', row.mine && 'bg-void/60')}
              >
                <td className="py-1.5 pr-2 text-aura">{row.place}</td>
                <td
                  title={row.name}
                  className={clsx(
                    'max-w-0 truncate py-1.5 pr-2 font-semibold',
                    row.mine ? 'text-plasma' : 'text-cream'
                  )}
                >
                  {row.name}
                </td>
                <td className="py-1.5 pr-2 text-right tabular-nums">{clockText(row.time_ms)}</td>
                <td className="py-1.5 text-right tabular-nums">{row.sent_home}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {signedIn && <PersonalBest minutes={minutes} best={best} />}
    </section>
  );
}

/**
 * Survival's leaderboard, a board for each run length: each player's best run, and
 * the signed-in viewer's personal best. Read on every request; when the database
 * cannot be reached the rest of the page still shows.
 */
export default async function Leaderboard() {
  await connection();
  const viewer = (await auth())?.user?.id ?? null;
  let leaderboard: Awaited<ReturnType<typeof fetchLeaderboard>> | null = null;
  try {
    leaderboard = await fetchLeaderboard(viewer);
  } catch {
    // Logged by fetchLeaderboard.
  }
  return (
    <section aria-labelledby="leaderboard-heading" className="mb-12">
      <h2 id="leaderboard-heading" className="font-display text-2xl font-semibold text-cream">
        Leaderboard
      </h2>
      <p className="mt-2 text-sm text-aura">
        Each player&apos;s longest Survival run of each length, then the most cats sent home. Signed
        in, you name your run at the end of it.
      </p>
      {leaderboard ? (
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {RUN_LENGTHS.map((minutes) => (
            <Board
              key={minutes}
              minutes={minutes}
              rows={leaderboard.board[minutes]}
              best={leaderboard.mine[minutes]}
              signedIn={viewer !== null}
            />
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-aura">The leaderboard cannot be shown right now.</p>
      )}
    </section>
  );
}
