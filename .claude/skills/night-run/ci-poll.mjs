// Waits for GitHub Actions to finish on a commit this run pushed, and prints the
// outcome. Read-only and unauthenticated: the public REST API allows 60 requests
// an hour, which is why it waits before the first check and polls slowly.
//
// Usage: node .claude/skills/night-run/ci-poll.mjs <sha> <branch> [<branch>...]
// Prints one "<branch> <conclusion> <url>" line per completed run once every
// named branch has one, or a single "UNOBSERVED <reason>" line. Always exits 0:
// the output is the result, not the exit code.
//
// The CI_POLL_* variables exist to test this script quickly; a run never sets them.
//
// No process.exit(): on Windows it can abort Node with a libuv assertion while
// fetch still holds a keep-alive socket. Returning lets the process end by itself.

import { execFileSync } from 'node:child_process';

// The repository is read from `origin`, never hard-coded: it was renamed once
// (next.js-dashboard → Xenocats), and the old name is a different repository.
function originRepo() {
  try {
    const url = execFileSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8' }).trim();
    return url.match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/)?.[1] ?? null;
  } catch {
    return null;
  }
}

const repo = process.env.CI_POLL_REPO ?? originRepo();
const firstWait = Number(process.env.CI_POLL_FIRST_WAIT ?? 300);
const interval = Number(process.env.CI_POLL_INTERVAL ?? 180);
const timeout = Number(process.env.CI_POLL_TIMEOUT ?? 1800);
const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'night-run' };
const sleep = (seconds) => new Promise((resolve) => setTimeout(resolve, seconds * 1000));

async function poll(sha, branches) {
  const url = `https://api.github.com/repos/${repo}/actions/runs?head_sha=${sha}`;
  const end = Date.now() + timeout * 1000;
  let errors = 0;
  await sleep(firstWait);
  for (;;) {
    let runs = [];
    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      runs = (await res.json()).workflow_runs ?? [];
      errors = 0;
    } catch (exc) {
      // Network failure, rate limit or non-200. One is noise; two in a row is an answer.
      errors += 1;
      if (errors >= 2) return [`UNOBSERVED api-error ${exc}`];
    }

    const done = runs.filter((run) => run.status === 'completed');
    const doneBranches = new Set(done.map((run) => run.head_branch));
    if (branches.every((branch) => doneBranches.has(branch))) {
      return done.map((run) => `${run.head_branch} ${run.conclusion} ${run.html_url}`);
    }
    if (Date.now() > end) {
      const seen = runs.map((run) => `${run.head_branch}:${run.status}`);
      return [`UNOBSERVED timeout ${seen.length ? seen.join(' ') : 'no runs found'}`];
    }
    await sleep(interval);
  }
}

const [sha, ...branches] = process.argv.slice(2);
const lines = !repo
  ? ['UNOBSERVED origin is not a GitHub repository']
  : sha && branches.length > 0
    ? await poll(sha, branches)
    : ['UNOBSERVED usage: ci-poll.mjs <sha> <branch> [<branch>...]'];
console.log(lines.join('\n'));
