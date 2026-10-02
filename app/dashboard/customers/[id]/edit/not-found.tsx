import Link from 'next/link';
import CatState, { catStateLinkClass } from '@/app/ui/cat-state';

export default function NotFound() {
  return (
    <main className="flex h-full flex-col items-center justify-center">
      <CatState
        art="asleep"
        title="404 Not Found"
        as="h1"
        action={
          <Link href="/dashboard/customers" className={catStateLinkClass}>
            Back to the customers
          </Link>
        }
      >
        Could not find the requested customer.
      </CatState>
    </main>
  );
}
