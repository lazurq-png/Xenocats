// A PreToolUse hook (.claude/settings.json): refuses a shell command that would seed
// or reset a database outside the private network ranges. scripts/db.mjs refuses
// the same itself; this stops the command before it runs, whoever runs it, and in
// every permission mode (a hook's refusal holds where a prompt would not be asked).
//
// Reads the tool call as JSON on stdin; exits 2 with the reason on stderr to block
// it, 0 to let it run. Prints nothing about the URL but the host's verdict.
import { readFileSync } from 'node:fs';
import { isIP } from 'node:net';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/** The same rule as scripts/db.mjs's isPrivateHost: localhost or a private IPv4 literal. */
export function isPrivateHost(host) {
  if (host === 'localhost') return true;
  if (isIP(host) !== 4) return false;
  return (
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  );
}

/** Whether a shell command seeds or resets: the npm scripts, or db.mjs directly. */
export const seedsOrResets = (command) =>
  /\bdb:(seed|reset)\b/.test(command) || /scripts[\\/]db\.mjs\s+(seed|reset)\b/.test(command);

/**
 * The POSTGRES_URL the command would use: one set on the command line, else the
 * environment's, else .env's (the npm scripts load it); null if none.
 */
export function urlFor(command, env, projectDir) {
  // `POSTGRES_URL=…` (sh), `$env:POSTGRES_URL=…` (PowerShell), `set POSTGRES_URL=…` (cmd).
  const inline = /(?:^|\s|\$env:)POSTGRES_URL\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s&;]+))/.exec(
    command
  );
  if (inline) return inline[1] ?? inline[2] ?? inline[3];
  if (env.POSTGRES_URL) return env.POSTGRES_URL;
  try {
    const line = readFileSync(join(projectDir, '.env'), 'utf8')
      .split(/\r?\n/)
      .find((l) => /^\s*POSTGRES_URL\s*=/.test(l));
    return line ? line.replace(/^\s*POSTGRES_URL\s*=\s*/, '').replace(/^["']|["']$/g, '') : null;
  } catch {
    return null;
  }
}

/** The reason to refuse the command, or null to let it run. */
export function refusal(command, env, projectDir) {
  if (!seedsOrResets(command)) return null;
  const url = urlFor(command, env, projectDir);
  // No URL: db.mjs fails on its own, with its own message.
  if (!url) return null;
  let host;
  try {
    host = new URL(url).hostname;
  } catch {
    return 'POSTGRES_URL is not a URL: refusing to seed or reset (scripts/db.mjs would fail too).';
  }
  if (isPrivateHost(host)) return null;
  return `Refusing to seed or reset ${host}: not a private-network host. Demo data and a drop belong only on a development database (CLAUDE.md §9).`;
}

// Run as the hook (not when a test imports it).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => (input += chunk));
  process.stdin.on('end', () => {
    let command = '';
    try {
      command = JSON.parse(input).tool_input?.command ?? '';
    } catch {
      return; // Not a tool call this hook understands: let it be.
    }
    const reason = refusal(command, process.env, process.env.CLAUDE_PROJECT_DIR ?? process.cwd());
    if (reason) {
      process.stderr.write(reason + '\n');
      process.exitCode = 2;
    }
  });
}
