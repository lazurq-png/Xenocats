import { describe, expect, it, vi } from 'vitest';
import { config } from '@/proxy';

// proxy.ts builds its handler with next-auth, which only loads inside Next; the
// matcher is all this test needs.
vi.mock('next-auth', () => ({ default: () => ({ auth: () => undefined }) }));

// The proxy runs the `authorized` callback, which sends a signed-in user from any
// path outside /dashboard and /cats to /dashboard. A static file it matches is
// therefore answered with a redirect to a page, and an <img> of it breaks.
const matcher = new RegExp(`^${config.matcher[0]}$`);

describe('proxy matcher', () => {
  it('runs on pages', () => {
    for (const path of ['/', '/login', '/cats', '/dashboard', '/dashboard/invoices/create']) {
      expect(matcher.test(path), path).toBe(true);
    }
  });

  it('skips static images, so a signed-in user is never redirected away from one', () => {
    for (const path of [
      '/xenocats/cats/void-tabby-asleep.webp',
      '/xenocats/bg-login.webp',
      '/icon.svg',
      '/opengraph-image.png',
    ]) {
      expect(matcher.test(path), path).toBe(false);
    }
  });
});
