'use client';

import Link from 'next/link';
import { type FormEvent, useState } from 'react';
import { Button } from '@/app/ui/button';
import { type SurvivalRunResult, recordSurvivalRun } from '@/app/lib/actions';
import { LeaderboardName } from '@/app/lib/schemas';
import type { RunLength } from './arena-storage';
import { boardName, readLeaderboardName, writeLeaderboardName } from './arena-storage';

const MESSAGES: Record<Exclude<SurvivalRunResult, 'saved'>, string> = {
  'signed-out': 'You are no longer logged in: log in to put your runs on the leaderboard.',
  invalid:
    'This run cannot go on the leaderboard: it was saved already, or another run was started since.',
  error: 'The run could not be saved. Try again.',
};

/**
 * On the results of a run: the name to put it on its length's leaderboard under
 * (offered again from the last one), for a signed-in player. `runId` is the run the
 * server started for it (startSurvivalRun). A run that used any test hook
 * (`testHooks`, their names: activeTestHooks) is not ranked, and says which.
 */
export function LeaderboardEntry({
  runId,
  minutes,
  timeMs,
  sentHome,
  signedIn,
  testHooks,
}: {
  runId: Promise<string | null>;
  minutes: RunLength;
  timeMs: number;
  sentHome: number;
  signedIn: boolean;
  testHooks: readonly string[];
}) {
  const [name, setName] = useState(readLeaderboardName);
  const [status, setStatus] = useState<SurvivalRunResult | 'saving' | null>(null);
  // The name as it was saved, or what is wrong with the one typed.
  const [savedAs, setSavedAs] = useState('');
  const [problem, setProblem] = useState('');

  if (testHooks.length > 0) {
    return (
      <p data-testid="leaderboard-entry" className="mt-4 text-sm text-aura">
        {`Not ranked on the leaderboard: this run used test settings (${testHooks
          .map((hook) => `?${hook}=`)
          .join(', ')}).`}
      </p>
    );
  }
  if (!signedIn) {
    return (
      <p data-testid="leaderboard-entry" className="mt-4 text-sm text-aura">
        <Link href="/login" className="font-semibold text-cream underline hover:text-plasma">
          Log in
        </Link>{' '}
        or{' '}
        <Link href="/signup" className="font-semibold text-cream underline hover:text-plasma">
          create an account
        </Link>{' '}
        to put your runs on the leaderboard.
      </p>
    );
  }
  if (status === 'saved') {
    return (
      <p data-testid="leaderboard-entry" role="status" className="mt-4 text-sm text-plasma">
        On {boardName(minutes)} as {savedAs}.{' '}
        <Link href="/cats" className="font-semibold text-cream underline hover:text-plasma">
          See the leaderboard
        </Link>
      </p>
    );
  }

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (status === 'saving') return;
    // The same rule the server holds it to, so a bad name is told at once.
    const checked = LeaderboardName.safeParse(name);
    if (!checked.success) {
      setProblem(checked.error.issues[0].message);
      return;
    }
    setProblem('');
    setStatus('saving');
    writeLeaderboardName(checked.data);
    try {
      const id = await runId;
      if (!id) {
        setStatus('error');
        return;
      }
      // The run's clock counts in fractions of a millisecond; the board in whole ones.
      const result = await recordSurvivalRun({
        runId: id,
        name: checked.data,
        timeMs: Math.floor(timeMs),
        sentHome,
      });
      setSavedAs(checked.data);
      setStatus(result);
    } catch {
      setStatus('error');
    }
  };

  const message = problem || (status && status !== 'saving' ? MESSAGES[status] : '');
  return (
    <form data-testid="leaderboard-entry" onSubmit={save} className="mt-4" noValidate>
      <label htmlFor="leaderboard-name" className="block text-sm font-semibold text-cream">
        Your name on {boardName(minutes)}
      </label>
      <div className="mt-1 flex flex-wrap gap-2">
        <input
          id="leaderboard-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          maxLength={20}
          autoComplete="nickname"
          aria-invalid={problem ? true : undefined}
          aria-describedby="leaderboard-entry-status"
          className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-void px-3 text-sm text-white focus:border-aura focus:ring-aura"
        />
        <Button type="submit" aria-disabled={status === 'saving'}>
          Save to the leaderboard
        </Button>
      </div>
      <p id="leaderboard-entry-status" aria-live="polite" className="mt-1 text-sm text-red-400">
        {message}
      </p>
    </form>
  );
}
