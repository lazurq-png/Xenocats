import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

const eslintConfig = defineConfig([
  ...nextVitals,
  {
    // The app logs only what goes wrong (console.error, console.warn): no debug
    // output, which can carry customers' data into the server's logs. Scripts and
    // tests may print.
    files: ['app/**', 'auth.ts', 'auth.config.ts', 'proxy.ts'],
    rules: { 'no-console': ['error', { allow: ['error', 'warn'] }] },
  },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
]);

export default eslintConfig;
