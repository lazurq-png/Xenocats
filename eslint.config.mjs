import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

const eslintConfig = defineConfig([
  ...nextVitals,
  {
    // Comparisons and loops that cannot be what was meant, everywhere: a value compared
    // with itself, `==` (but `== null`, for null or undefined at once), an expression
    // whose result is fixed on its face (`{} ?? b`, `x === []`; types are not read), a loop
    // whose condition nothing in it changes or whose body always leaves it, and `${}`
    // in a plain string.
    rules: {
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-self-compare': 'error',
      'no-constant-binary-expression': 'error',
      'no-unmodified-loop-condition': 'error',
      'no-unreachable-loop': 'error',
      'no-template-curly-in-string': 'error',
    },
  },
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
