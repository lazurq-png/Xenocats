import { randomBytes } from 'node:crypto';
import { defineConfig, devices } from '@playwright/test';

// Its own port, so a `npm run dev` already running on 3000 is never reused by accident.
const PORT = 3100;

// The tests get their own schema, `xenocats_test`, on the database POSTGRES_URL
// names (from .env unless the environment sets it), rebuilt and seeded before
// every run by global-setup.ts. Without a URL, or with E2E_NO_DATABASE=1 (the
// database is unreachable), the tests that need it skip.
try {
  process.loadEnvFile('.env');
} catch {
  // No .env: only the environment's variables count.
}
if (process.env.E2E_NO_DATABASE) {
  delete process.env.E2E_POSTGRES_URL;
} else if (process.env.POSTGRES_URL && !process.env.E2E_POSTGRES_URL) {
  const url = new URL(process.env.POSTGRES_URL);
  url.searchParams.set('search_path', 'xenocats_test');
  process.env.E2E_POSTGRES_URL = url.toString();
}
const database = process.env.E2E_POSTGRES_URL;

// `dev` by default: it needs no build, so browser tests of pages that do not read
// the database run even where the database is unreachable. E2E_SERVER=start tests
// the production build instead (`next build` must have run first); CI does both.
const server =
  process.env.E2E_SERVER === 'start'
    ? `npx next start -p ${PORT}`
    : `npx next dev --turbopack -p ${PORT}`;

export default defineConfig({
  testDir: 'tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: server,
    url: `http://localhost:${PORT}`,
    // Never reuse a server already on the port: its POSTGRES_URL may not be the
    // test schema, and the tests write.
    reuseExistingServer: false,
    timeout: 120_000,
    // A throwaway session secret, always (not .env's): NextAuth refuses to run
    // without one, and test sessions never need to outlive the test server.
    env: {
      AUTH_SECRET: randomBytes(32).toString('base64'),
      AUTH_TRUST_HOST: 'true',
      // .env's AUTH_URL names `npm run dev`'s port; after a login NextAuth would redirect there.
      AUTH_URL: `http://localhost:${PORT}`,
      // Overrides .env, which Next would otherwise load: the server must use the test schema.
      ...(database ? { POSTGRES_URL: database } : {}),
    },
  },
});
