// Runs once when a server instance starts (Next.js instrumentation). It only says
// what the server cannot know from a request: that no proxy is trusted to name
// the client's address, so the address limits fall back (app/lib/sign-up-limit.ts).
export async function register() {
  // The Node.js server only: sign-up-limit.ts imports node:crypto.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { proxyWarning } = await import('@/app/lib/sign-up-limit');
  const warning = proxyWarning();
  if (warning) console.warn(warning);
}
