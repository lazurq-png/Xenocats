import { execFileSync } from 'node:child_process';

// Rebuilds the test schema from db/migrations and the placeholder data before
// every run, so the tests start from the same rows and may write to them.
// scripts/db.mjs refuses a database outside the private network.
export default function globalSetup() {
  const database = process.env.E2E_POSTGRES_URL;
  if (!database) return;
  execFileSync(
    process.execPath,
    ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', 'scripts/db.mjs', 'reset'],
    { env: { ...process.env, POSTGRES_URL: database }, stdio: 'inherit' }
  );
}
