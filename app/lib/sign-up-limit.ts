import { createHmac } from 'node:crypto';
import type { Sql } from 'postgres';
import { positiveInteger } from '@/app/lib/login-limit';

// The sign-up limit: at most N accounts a day from one client address (N from
// SIGNUP_MAX_PER_DAY, else 2). Counted in `sign_up_limits` (db/migrations/0006)
// in one statement, as the login lockout counts, so concurrent sign-ups cannot all
// slip past it. Every valid sign-up form counts, a taken username too: so names
// cannot be probed for either. The address is kept only as a keyed hash.

/** N, from the environment: a whole number above zero, else 2. */
export const signUpLimit = (env: Record<string, string | undefined> = process.env) =>
  positiveInteger(env.SIGNUP_MAX_PER_DAY, 2);

/**
 * The header that carries the client's address, when a proxy in front of the app
 * sets it (and so overwrites whatever the client sent): `x-real-ip` on Vercel (which
 * sets VERCEL=1) or where TRUSTED_PROXY_HEADER=x-real-ip; the last entry of
 * `x-forwarded-for` (the one the nearest proxy added) where
 * TRUSTED_PROXY_HEADER=x-forwarded-for. Otherwise none: a request's headers are then
 * the client's own say, and are not believed.
 */
export function trustedProxyHeader(
  env: Record<string, string | undefined> = process.env
): 'x-real-ip' | 'x-forwarded-for' | null {
  const named = env.TRUSTED_PROXY_HEADER?.trim().toLowerCase();
  if (named === 'x-real-ip' || named === 'x-forwarded-for') return named;
  return env.VERCEL === '1' ? 'x-real-ip' : null;
}

/**
 * The client's address, from the trusted proxy's header. With no trusted proxy (or
 * no address in its header), 'unknown': every such client shares one count, so the
 * limit holds for all of them together rather than not at all.
 */
export function clientAddress(
  headers: Headers,
  trusted: ReturnType<typeof trustedProxyHeader> = trustedProxyHeader()
): string {
  const address =
    trusted === 'x-real-ip'
      ? headers.get('x-real-ip')
      : trusted === 'x-forwarded-for'
        ? headers.get('x-forwarded-for')?.split(',').at(-1)
        : null;
  return address?.trim() || 'unknown';
}

/**
 * What an address is counted as: an IPv6 address by its /64 (one household or
 * machine has all of a /64, and could otherwise take a new address per sign-up); an
 * IPv4 one (also written as ::ffff:a.b.c.d) as itself.
 */
export function addressBlock(address: string): string {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  if (mapped) return mapped[1];
  if (!address.includes(':')) return address;
  const [head, tail = ''] = address.toLowerCase().split('%')[0].split('::');
  const left = head ? head.split(':') : [];
  const right = address.includes('::') && tail ? tail.split(':') : [];
  const groups = address.includes('::')
    ? [...left, ...Array(Math.max(8 - left.length - right.length, 0)).fill('0'), ...right]
    : left;
  return `${groups
    .slice(0, 4)
    .map((group) => parseInt(group || '0', 16).toString(16))
    .join(':')}::/64`;
}

/**
 * The key an address is counted under: a hash of its block keyed with the app's
 * secret. With no secret it throws: a hash keyed with nothing would give the
 * addresses away to anyone who can read the table.
 */
export function clientKey(address: string, secret = process.env.AUTH_SECRET) {
  if (!secret) throw new Error('AUTH_SECRET is not set: the sign-up limit cannot key addresses.');
  return createHmac('sha256', secret).update(addressBlock(address)).digest('hex');
}

/** Counts a sign-up from `key` and says whether it is within the day's limit. */
export async function claimSignUp(sql: Sql, key: string, max: number): Promise<boolean> {
  const [{ sign_ups }] = await sql<{ sign_ups: number }[]>`
    INSERT INTO sign_up_limits AS l (client, sign_ups, window_start)
    VALUES (${key}, 1, now())
    ON CONFLICT (client) DO UPDATE SET
      -- A day after the first sign-up of the window, the count starts again.
      sign_ups = CASE WHEN l.window_start <= now() - interval '1 day' THEN 1 ELSE l.sign_ups + 1 END,
      window_start = CASE
        WHEN l.window_start <= now() - interval '1 day' THEN now()
        ELSE l.window_start
      END
    RETURNING sign_ups`;
  return sign_ups <= max;
}
