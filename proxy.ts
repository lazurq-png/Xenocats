import NextAuth from 'next-auth';
import { authConfig } from './auth.config';

export default NextAuth(authConfig).auth;

export const config = {
  // https://nextjs.org/docs/app/api-reference/file-conventions/proxy#matcher
  // Static images stay out: the `authorized` callback would redirect a signed-in
  // user's request for one to /dashboard, and the <img> would break.
  matcher: ['/((?!api|_next/static|_next/image|.*\\.(?:png|webp|svg|jpg|jpeg|ico)$).*)'],
};
