import { afterEach, describe, expect, it, vi } from 'vitest';

// clientAddress (app/lib/sign-up-limit.ts) warns, once a process and in production
// only, when a trusted proxy header is named but a request comes without it: the
// proxy may not be setting it, and every such client then shares one count. A fresh
// module per test: the "once" is the module's.

async function fresh(env: Record<string, string>) {
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  vi.resetModules();
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const { clientAddress } = await import('@/app/lib/sign-up-limit');
  return { clientAddress, warn };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('a trusted proxy header that requests come without', () => {
  it('is warned of once, in production', async () => {
    const { clientAddress, warn } = await fresh({ NODE_ENV: 'production' });
    expect(clientAddress(new Headers(), 'x-real-ip')).toBe('unknown');
    expect(clientAddress(new Headers({ 'x-forwarded-for': ' ' }), 'x-forwarded-for')).toBe(
      'unknown'
    );
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/trusted proxy header \(x-real-ip/);
  });

  it('names the header only, never what the request held', async () => {
    const { clientAddress, warn } = await fresh({ NODE_ENV: 'production' });
    // An address first, and the last entry (the proxy's) empty.
    const headers = new Headers({ 'x-forwarded-for': '203.0.113.7, ' });
    expect(clientAddress(headers, 'x-forwarded-for')).toBe('unknown');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/x-forwarded-for/);
    expect(warn.mock.calls[0][0]).not.toMatch(/203\.0\.113\.7/);
  });

  it('is not warned of when the header is there, when none is named, or outside production', async () => {
    const prod = await fresh({ NODE_ENV: 'production' });
    expect(prod.clientAddress(new Headers({ 'x-real-ip': '203.0.113.7' }), 'x-real-ip')).toBe(
      '203.0.113.7'
    );
    expect(prod.clientAddress(new Headers(), null)).toBe('unknown');
    expect(prod.warn).not.toHaveBeenCalled();

    const dev = await fresh({ NODE_ENV: 'development' });
    expect(dev.clientAddress(new Headers(), 'x-real-ip')).toBe('unknown');
    expect(dev.warn).not.toHaveBeenCalled();
  });
});
