import NextAuth, { CredentialsSignin } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from './auth.config';
import { checkCredentials } from '@/app/lib/credentials';
import { LOCKED } from '@/app/lib/login-limit';
import { revokeSession } from '@/app/lib/session-version';
import { sql } from '@/app/lib/db';

/** A refused login for an email that is locked out; `authenticate` says so. */
class LoginLocked extends CredentialsSignin {
  code = LOCKED;
}

export const { auth, signIn, signOut } = NextAuth({
  ...authConfig,
  events: {
    /**
     * Signing out ends the session on the server too, not only its cookie: a
     * request still in flight (a dashboard prefetch) would set the cookie again,
     * and it must be dead when it does (session-version.ts).
     */
    async signOut(message) {
      const token = 'token' in message ? message.token : null;
      if (typeof token?.sessionId === 'string' && typeof token.exp === 'number') {
        try {
          await revokeSession(token.sessionId, token.exp);
        } catch (error) {
          // The cookie still goes: signing out is not refused for want of a database.
          console.error('Failed to revoke the session:', error);
        }
      }
    },
  },
  providers: [
    Credentials({
      // The decision is checkCredentials' (app/lib/credentials.ts).
      async authorize(credentials) {
        const result = await checkCredentials(sql, credentials);
        if (result === LOCKED) throw new LoginLocked();
        return result;
      },
    }),
  ],
});
