---
name: verify
description: Run this repository's checks on the current change, cheapest first, stopping at the first failure: Prettier on the changed files, lint, type check, then the tests the change can reach (npm run test:affected). Use after making a change and before reporting it, or when asked to "verify", "check" or "run the checks".
---

# Verify

The checks `CLAUDE.md` §9 names, in the order that finds a problem soonest: each
costs more than the one before, and a failure stops the run there, since a type
error found in seconds makes the browser tests pointless. The table of checks is
in `README.md` ("Checks").

Run them **one after another, never side by side**: the browser tests are
timing-sensitive and fail under the load of a parallel build or suite.

## 1. The change

The files it touches, compared as `npm run test:affected` compares them: from
where the branch left `<base>` (`main`, `dev` or `Nightrun`, the one it will join),
plus the new files:

```bash
git diff --name-only $(git merge-base <base> HEAD)
git ls-files --others --exclude-standard
```

## 2. The checks, in order

Stop at the first that fails, and report it with its output.

1. **Formatting**, the changed files only (never `npm run format`, which rewrites
   files the change did not touch):

   ```bash
   npx prettier --check <the changed files>
   ```

   Markdown and `tsconfig.json` are left out by `.prettierignore`; naming them is
   harmless.

2. **Lint.** It exits non-zero on errors only: read the output for warnings too,
   and compare with before the change.

   ```bash
   npm run lint
   ```

3. **Type check**, with the route types generated first (stale ones fail it for
   no reason in the code):

   ```bash
   npx next typegen && npx tsc --noEmit
   ```

4. **Test groups**, only if the change adds, renames or moves a test file or
   changes the Vitest projects (CI's *checks* job fails otherwise; and a spec in
   no group makes step 5 fail with no test found): a browser spec is named in
   exactly one group of `GROUPS` in `playwright.config.ts`, and

   ```bash
   node scripts/unit-projects.mjs
   ```

   says every unit test file is in one project.

5. **The tests the change can reach.** Print the selection, then run it:

   ```bash
   npm run test:affected -- --base <base>          # what it would run
   npm run test:affected -- --base <base> --run    # run it, stopping at the first failure
   ```

   It prints the unit tests (`vitest related`), the browser specs that visit a
   route the change reaches, and a `database:` line when a query or the schema
   changed (the opt-in database tests, which `--run` includes). A line that says
   `FULL` is run in full by `--run` itself, the unit and the browser lines each on
   its own; nothing needs adding. Never shrink the selection by hand.

## 3. Repairing

While repairing a failure, rerun only what failed: the one check, or the one test
(`npx vitest run <file>`, `npx playwright test <spec> -g "<title>"`,
`--last-failed`; the database tests as `DATABASE_TESTS=1 npx vitest run
tests/unit/data`, since without it every one of them skips and the rerun passes:
read the skipped count). Once it passes, run the whole sequence again from step 1, once,
on the final state: a fix to a test can break the formatting, the lint or the
types, and the report is about the code as it is.

## 4. What this does not cover

- **The build** (`npm run build`), where a change can affect what is prerendered
  or how a page compiles: run it after the tests when the change touches pages,
  layouts, the proxy or the Next config.
- **`E2E_SERVER=start npm run test:e2e`**, the browser tests against the
  production server, which CI's *build* job runs where work is merged
  (`CLAUDE.md` §9).
- **A page seen in a browser.** Tests prove an interaction works, not that the
  page looks right: for a UI change, `npm run dev` and look
  (`.claude/rules/frontend.md`).
- **A workflow change.** actionlint skips the shellcheck and pyflakes rules, and
  still reports clean, when it cannot find them: check all three are there, and
  name both.

  ```bash
  command -v actionlint shellcheck pyflakes
  actionlint -shellcheck "$(command -v shellcheck)" -pyflakes "$(command -v pyflakes)"
  ```

## 5. Report

The final run's results, check by check: the command, and what it printed: exit
code, the lint warnings against before, the test runners' counts (passed,
skipped, failed). A check that did not run is said to have not run. Never report
a result that was not observed (`CLAUDE.md` §17).
