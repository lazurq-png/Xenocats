import { beforeEach, describe, expect, it, vi } from 'vitest';
const { isCurrentSession } = vi.hoisted(() => ({ isCurrentSession: vi.fn() }));
vi.mock('@/app/lib/session-version', () => ({ isCurrentSession }));

const { authConfig, SESSION_MAX_AGE } = await import('@/auth.config');

type Authorized = (params: {
  auth: { user?: object } | null;
  request: { nextUrl: URL };
}) => boolean | Response;

const authorized = authConfig.callbacks.authorized as unknown as Authorized;

function visit(path: string, loggedIn: boolean) {
  return authorized({
    auth: loggedIn ? { user: { id: 'u1', email: 'user@example.com' } } : null,
    request: { nextUrl: new URL(path, 'http://localhost:3000') },
  });
}

function redirectTarget(result: boolean | Response) {
  return result instanceof Response ? new URL(result.headers.get('location')!).pathname : null;
}

describe('authorized', () => {
  it("counts a session without its user's id (an older login) as signed out", () => {
    const nextUrl = new URL('/dashboard', 'http://localhost:3000');
    expect(
      authorized({ auth: { user: { email: 'user@example.com' } }, request: { nextUrl } })
    ).toBe(false);
  });

  it('keeps the dashboard for signed-in users only', () => {
    expect(visit('/dashboard', true)).toBe(true);
    expect(visit('/dashboard/invoices', true)).toBe(true);
    expect(visit('/dashboard', false)).toBe(false); // → the login page
    expect(visit('/dashboard/invoices/create', false)).toBe(false);
  });

  it('sends a signed-in user from other pages to the dashboard', () => {
    expect(redirectTarget(visit('/login', true))).toBe('/dashboard');
    expect(redirectTarget(visit('/', true))).toBe('/dashboard');
  });

  it('lets anyone see other pages when signed out', () => {
    expect(visit('/', false)).toBe(true);
    expect(visit('/login', false)).toBe(true);
  });

  it('opens /cats to everyone, signed in or not', () => {
    expect(visit('/cats', false)).toBe(true);
    expect(visit('/cats', true)).toBe(true);
    expect(visit('/cats/void-tabby', true)).toBe(true);
  });

  it('does not open look-alike paths', () => {
    expect(redirectTarget(visit('/catsuit', true))).toBe('/dashboard');
    expect(redirectTarget(visit('/cats-admin', true))).toBe('/dashboard');
  });
});

describe('session', () => {
  type SessionCallback = (params: {
    session: { user?: { id?: string; email?: string }; expires: string };
    token: { sub?: string };
  }) => { user?: { id?: string } };
  const session = authConfig.callbacks.session as unknown as SessionCallback;

  it("carries the user's id from the token", () => {
    const result = session({
      session: { user: { email: 'user@example.com' }, expires: '' },
      token: { sub: 'u1' },
    });
    expect(result.user?.id).toBe('u1');
  });

  it('a token without one gives a session without one', () => {
    const result = session({ session: { user: { email: 'a@b.c' }, expires: '' }, token: {} });
    expect(result.user?.id).toBeUndefined();
  });
});

describe('jwt', () => {
  beforeEach(() => isCurrentSession.mockReset());
  type Jwt = (params: {
    token: { sub?: string; sessionVersion?: number; sessionId?: string; loginAt?: number };
    user?: { session_version?: number };
  }) => Promise<{ sessionId?: string } | null>;
  const jwt = authConfig.callbacks.jwt as unknown as Jwt;
  const now = () => Math.floor(Date.now() / 1000);

  it('puts the account’s session version and a fresh session id in the token at login, without asking the database', async () => {
    const first = await jwt({ token: { sub: 'u1' }, user: { session_version: 3 } });
    expect(first).toEqual({
      sub: 'u1',
      sessionVersion: 3,
      sessionId: expect.any(String),
      loginAt: expect.any(Number),
    });
    const second = await jwt({ token: { sub: 'u1' }, user: { session_version: 3 } });
    // Each login its own: signing out of one leaves the others.
    expect(second?.sessionId).not.toBe(first?.sessionId);
    expect(isCurrentSession).not.toHaveBeenCalled();
  });

  it('keeps a token that is still current', async () => {
    isCurrentSession.mockResolvedValueOnce(true);
    const token = { sub: 'u1', sessionVersion: 3, sessionId: 's1', loginAt: now() };
    expect(await jwt({ token })).toBe(token);
    expect(isCurrentSession).toHaveBeenCalledWith('u1', 3, 's1');
  });

  it('lasts seven days, by the cookie and by the login itself', () => {
    expect(SESSION_MAX_AGE).toBe(7 * 24 * 60 * 60);
    expect(authConfig.session).toEqual({ strategy: 'jwt', maxAge: SESSION_MAX_AGE });
  });

  it('signs out a login older than seven days, however often it was used, without asking the database', async () => {
    const token = { sub: 'u1', sessionVersion: 3, sessionId: 's1' };
    expect(await jwt({ token: { ...token, loginAt: now() - SESSION_MAX_AGE - 60 } })).toBeNull();
    expect(isCurrentSession).not.toHaveBeenCalled();
    // Just inside the week: still checked, and kept.
    isCurrentSession.mockResolvedValueOnce(true);
    const fresh = { ...token, loginAt: now() - SESSION_MAX_AGE + 60 };
    expect(await jwt({ token: fresh })).toBe(fresh);
  });

  it('signs out a login from before its time was kept: its cookie may have 30 days of its own', async () => {
    expect(await jwt({ token: { sub: 'u1', sessionVersion: 3, sessionId: 's1' } })).toBeNull();
    expect(isCurrentSession).not.toHaveBeenCalled();
  });

  it('drops a token that is no longer current (password changed, or signed out): signed out', async () => {
    isCurrentSession.mockResolvedValueOnce(false);
    expect(
      await jwt({ token: { sub: 'u1', sessionVersion: 2, sessionId: 's1', loginAt: now() } })
    ).toBeNull();
    expect(isCurrentSession).toHaveBeenCalled();
  });
});
