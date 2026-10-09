import { describe, expect, it } from 'vitest';
import { authConfig } from '@/auth.config';

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
