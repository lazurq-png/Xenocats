import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// The speed benchmarks, run on demand: `npx vitest run -c vitest.bench.config.mts`.
// Not part of `npm test`, whose config includes tests/unit only.
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
  test: {
    include: ['tests/bench/**/*.test.ts'],
    environment: 'node',
    testTimeout: 300_000,
    // The tables the benchmarks print go straight to the terminal.
    disableConsoleIntercept: true,
  },
});
