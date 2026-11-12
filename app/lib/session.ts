import { cache } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';

/**
 * The request's session, read once however many Server Components ask: every
 * auth() runs the session query (isCurrentSession, through auth.config.ts), and the
 * dashboard's overview has three components that each need the user. React's
 * cache() keeps it for one server request only; outside a render (an action, a
 * route handler) it calls auth() each time.
 */
export const currentSession = cache(() => auth());

/**
 * The signed-in user's id: whose customers and invoices a page reads
 * (app/lib/data.ts). From the session, never from the request. proxy.ts sends a
 * visitor without one to the login before any page runs; this holds the same
 * rule should one get through.
 */
export async function currentUserId(): Promise<string> {
  const session = await currentSession();
  const id = session?.user?.id;
  if (!id) redirect('/login');
  return id;
}
