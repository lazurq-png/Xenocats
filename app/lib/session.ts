import { redirect } from 'next/navigation';
import { auth } from '@/auth';

/**
 * The signed-in user's id: whose customers and invoices a page reads
 * (app/lib/data.ts). From the session, never from the request. proxy.ts sends a
 * visitor without one to the login before any page runs; this holds the same
 * rule should one get through.
 */
export async function currentUserId(): Promise<string> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) redirect('/login');
  return id;
}
