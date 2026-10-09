import type { NextAuthConfig } from 'next-auth';

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
    /** The user's id, from the token signed at login (`sub`), on the session. */
    session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
  },
  providers: [], // Add providers with an empty array for now
} satisfies NextAuthConfig;
