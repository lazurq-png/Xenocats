import { afterEach, describe, expect, it, vi } from 'vitest';

// The session, read once per request (app/lib/session.ts). Every auth() runs the
// session query (isCurrentSession, through the jwt callback in auth.config.ts), so
// the dashboard's components, which each ask for the signed-in user, share one.
//
// React's cache() memoises only inside a server request, and only in React's
// server build (the one Next.js gives Server Components): elsewhere it calls
// through. So the server build stands in for 'react' here, and `inRequest` gives
// it a request's cache the way React's server renderer does, through the
// dispatcher's getCacheForType: a cache per request, none outside one.

const { React, auth } = await vi.hoisted(async () => {
  const { createRequire } = await import('node:module');
  const { resolve } = await import('node:path');
  const load = createRequire(import.meta.url);
  return {
    React: load(resolve('node_modules/react/react.react-server.js')),
    auth: vi.fn(async () => ({ user: { id: 'u1' }, expires: '' })),
  };
});
vi.mock('react', () => React);
vi.mock('@/auth', () => ({ auth }));
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`redirect ${to}`);
  },
}));

const { currentSession, currentUserId } = await import('@/app/lib/session');

const internals = React.__SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;

async function inRequest<T>(work: () => Promise<T>): Promise<T> {
  const caches = new Map<() => unknown, unknown>();
  internals.A = {
    getCacheForType(create: () => unknown) {
      if (!caches.has(create)) caches.set(create, create());
      return caches.get(create);
    },
  };
  try {
    return await work();
  } finally {
    internals.A = null;
  }
}

afterEach(() => {
  auth.mockClear();
});

describe('the session in a request', () => {
  it('is checked once, however many components ask for the user', async () => {
    // The overview: cards, latest invoices and the revenue chart, side by side.
    const ids = await inRequest(() =>
      Promise.all([currentUserId(), currentUserId(), currentUserId(), currentSession()])
    );
    expect(ids.slice(0, 3)).toEqual(['u1', 'u1', 'u1']);
    expect(auth).toHaveBeenCalledTimes(1);
  });

  it('is checked again in the next request: nothing carries over', async () => {
    await inRequest(() => currentUserId());
    await inRequest(() => currentUserId());
    expect(auth).toHaveBeenCalledTimes(2);
  });

  it('a signed-out request still goes to the login, from every caller', async () => {
    auth.mockResolvedValueOnce(null as never);
    await inRequest(async () => {
      await expect(currentUserId()).rejects.toThrow('redirect /login');
      await expect(currentUserId()).rejects.toThrow('redirect /login');
    });
    expect(auth).toHaveBeenCalledTimes(1);
  });
});
