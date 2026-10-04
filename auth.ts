import NextAuth, { CredentialsSignin } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from './auth.config';
import { z } from 'zod';
import type { User } from '@/app/lib/definitions';
import { LOCKED, claimAttempt, clearFailures, loginKey, loginLimits } from '@/app/lib/login-limit';
import bcryptjs from 'bcryptjs';
import postgres from 'postgres';

/** A refused login for an email that is locked out; `authenticate` says so. */
class LoginLocked extends CredentialsSignin {
  code = LOCKED;
}

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

async function getUser(email: string): Promise<User | undefined> {
  try {
    const user = await sql<User[]>`SELECT * FROM users WHERE email=${email}`;
    return user[0];
  } catch (error) {
    console.error('Failed to fetch user:', error);
    throw new Error('Failed to fetch user.');
  }
}

export const { auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsedCredentials = z
          .object({ email: z.string().email(), password: z.string().min(6) })
          .safeParse(credentials);

        if (parsedCredentials.success) {
          const { email, password } = parsedCredentials.data;
          const key = loginKey(email);
          // Counted before the password is looked at, so a locked email learns
          // nothing and concurrent attempts cannot get past the limit. An
          // unknown email counts like a wrong password.
          if (!(await claimAttempt(sql, key, loginLimits()))) throw new LoginLocked();
          const user = await getUser(email);
          const passwordsMatch = user ? await bcryptjs.compare(password, user.password) : false;

          if (user && passwordsMatch) {
            await clearFailures(sql, key);
            return user;
          }
        }

        return null;
      },
    }),
  ],
});
