import { afterEach, describe, expect, it, vi } from 'vitest';
import { register } from '@/instrumentation';

// instrumentation.ts: what a server says when it starts. When it speaks is
// proxyWarning's (input-safeguards.test.ts); this is that the hook calls it, in the
// Node.js runtime only, and says it once.

const start = async (env: Record<string, string | undefined>) => {
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  await register();
  return warn;
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('register', () => {
  it('warns once, in production on Node.js, with no trusted proxy header', async () => {
    const warn = await start({
      NEXT_RUNTIME: 'nodejs',
      NODE_ENV: 'production',
      VERCEL: undefined,
      TRUSTED_PROXY_HEADER: undefined,
    });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/No trusted proxy header/);
  });

  it('says nothing where a proxy is trusted, or outside production', async () => {
    for (const env of [
      { NEXT_RUNTIME: 'nodejs', NODE_ENV: 'production', VERCEL: '1' },
      { NEXT_RUNTIME: 'nodejs', NODE_ENV: 'production', TRUSTED_PROXY_HEADER: 'x-real-ip' },
      { NEXT_RUNTIME: 'nodejs', NODE_ENV: 'development', VERCEL: undefined },
    ]) {
      const warn = await start(env);
      expect(warn, JSON.stringify(env)).not.toHaveBeenCalled();
      vi.unstubAllEnvs();
      vi.restoreAllMocks();
    }
  });

  it('does nothing in the edge runtime, where it could not load node:crypto', async () => {
    const warn = await start({ NEXT_RUNTIME: 'edge', NODE_ENV: 'production', VERCEL: undefined });
    expect(warn).not.toHaveBeenCalled();
  });
});
