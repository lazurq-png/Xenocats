import type { NextAuthConfig } from 'next-auth';
import { isCurrentSession } from '@/app/lib/session-version';

/**
 * How long a login lasts, s: seven days (Auth.js's default is thirty). Counted from
 * the login itself (`loginAt` in the token), not from its last use: a JWT session's
 * cookie is issued again as it is used, so an expiry alone would end only one left
 * idle, and a stolen cookie in use would never end. A week after its login it is
 * signed out, however often it was used.
 */
export const SESSION_MAX_AGE = 7 * 24 * 60 * 60;

export const authConfig = {
  pages: {
    signIn: '/login',
  },
  session: { strategy: 'jwt', maxAge: SESSION_MAX_AGE },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      // Signed in means a session that names its user: every query and action is
      // scoped to that id, so a session without one (an older login) is signed out.
      const isLoggedIn = !!auth?.user?.id;
      const isOnDashboard = nextUrl.pathname.startsWith('/dashboard');
      // The public cat gallery: open to everyone, and logged-in users stay on it.
      const isOnCats = nextUrl.pathname === '/cats' || nextUrl.pathname.startsWith('/cats/');
      if (isOnCats) return true;
      if (isOnDashboard) {
        if (isLoggedIn) return true;
        return false; // Redirect unauthenticated users to login page
      } else if (isLoggedIn) {
        return Response.redirect(new URL('/dashboard', nextUrl));
      }
      return true;
    },
    /**
     * At login, the account's session version and an id of the login's own go into
     * the token; on every later request a token whose version is no longer the
     * account's (the password was changed since), or whose id was signed out, is
     * dropped: signed out, its cookie with it. Here, not only in
     * auth.ts, so proxy.ts sees the same: a session the pages refuse is not one it
     * would send back to them.
     */
    async jwt({ token, user }) {
      if (user) {
        token.sessionVersion = (user as { session_version?: number }).session_version ?? 0;
        // This login's own id, which signing out revokes (auth.ts, events.signOut).
        token.sessionId = crypto.randomUUID();
        // When it was made, s: it lasts SESSION_MAX_AGE from here.
        token.loginAt = Math.floor(Date.now() / 1000);
        return token;
      }
      if (!token.sub) return token;
      // Past its week, or from before loginAt was kept (such a cookie may still have
      // 30 days of its own, and outlive the revocation of a sign-out): signed out, to
      // log in again.
      const loginAt = token.loginAt;
      if (typeof loginAt !== 'number' || Date.now() / 1000 - loginAt > SESSION_MAX_AGE) {
        return null;
      }
      return (await isCurrentSession(token.sub, token.sessionVersion, token.sessionId))
        ? token
        : null;
    },
    /** The user's id, from the token signed at login (`sub`), on the session. */
    session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
    /**
     * Where a login or sign-out sends the visitor: only ever this site. The address
     * (the login's `callbackUrl`, which anyone can write) is resolved as a browser
     * would resolve it, so `//elsewhere` and `/\elsewhere` are another site, and
     * refused for the home page; one on this site keeps its path with a single
     * leading slash, which no browser reads as a host. (Auth.js's own default joins
     * a path to the site's address as it is, and `//elsewhere` then reads as
     * another host to the browser that follows it.)
     */
    redirect({ url, baseUrl }) {
      const site = new URL(baseUrl);
      let target: URL;
      try {
        target = new URL(url, site);
      } catch {
        return site.origin;
      }
      if (target.origin !== site.origin) return site.origin;
      return `${site.origin}${target.pathname.replace(/^[/\\]+/, '/')}${target.search}${target.hash}`;
    },
  },
  providers: [], // Add providers with an empty array for now
} satisfies NextAuthConfig;
