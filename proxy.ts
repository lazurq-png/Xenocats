import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import { authConfig } from './auth.config';
import { contentSecurityPolicy, newNonce } from '@/app/lib/csp';

const { auth } = NextAuth(authConfig);

// Every request the matcher lets through: which pages need a session (the
// `authorized` callback), and the Content-Security-Policy with a nonce of its own
// (app/lib/csp.ts), on the response and on the request, where Next.js reads the
// nonce to put on the page's scripts as it renders.
export default auth(async (request) => {
  // next-auth ran `authorized` first, and answered a redirect it returned without
  // coming here. A plain no it passes on to this function rather than acting on, so
  // ask again, and send the visitor to the login as next-auth would.
  const policy = contentSecurityPolicy(newNonce(), process.env.NODE_ENV === 'development');
  // Any no, as next-auth reads it (not only `false`), and awaited, should it ever be async.
  if (!(await authConfig.callbacks.authorized({ auth: request.auth, request }))) {
    const login = request.nextUrl.clone();
    login.pathname = authConfig.pages.signIn;
    login.searchParams.set('callbackUrl', request.nextUrl.href);
    const redirect = NextResponse.redirect(login);
    // (Its nonce goes unused: a redirect has no page. The redirects next-auth answers
    // itself, a signed-in visitor sent to /dashboard, carry no policy.)
    redirect.headers.set('Content-Security-Policy', policy);
    return redirect;
  }
  const headers = new Headers(request.headers);
  headers.set('Content-Security-Policy', policy);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set('Content-Security-Policy', policy);
  return response;
});

export const config = {
  // https://nextjs.org/docs/app/api-reference/file-conventions/proxy#matcher
  // Static images stay out: the `authorized` callback would redirect a signed-in
  // user's request for one to /dashboard, and the <img> would break.
  matcher: ['/((?!_next/static|_next/image|.*\\.(?:png|webp|svg|jpg|jpeg|ico)$).*)'],
};
