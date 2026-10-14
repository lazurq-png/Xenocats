import type { NextAuthConfig } from 'next-auth';
import { isCurrentSession } from '@/app/lib/session-version';

export const authConfig = {
  pages: {
    signIn: '/login',
  },
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
        return token;
      }
      if (!token.sub) return token;
      return (await isCurrentSession(token.sub, token.sessionVersion, token.sessionId))
        ? token
        : null;
    },
    /** The user's id, from the token signed at login (`sub`), on the session. */
    session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
  },
  providers: [], // Add providers with an empty array for now
} satisfies NextAuthConfig;
