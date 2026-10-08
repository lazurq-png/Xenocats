import NextAuth, { CredentialsSignin } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from './auth.config';
import { checkCredentials } from '@/app/lib/credentials';
import { LOCKED } from '@/app/lib/login-limit';
import postgres from 'postgres';

/** A refused login for an email that is locked out; `authenticate` says so. */
class LoginLocked extends CredentialsSignin {
  code = LOCKED;
}

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

export const { auth, signIn, signOut } = NextAuth({
  ...authConfig,
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
