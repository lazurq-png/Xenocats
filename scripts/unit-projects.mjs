// Checks that every unit test file is in exactly one Vitest project (vitest.config.mts):
// CI runs the tests a project at a time, so a file in none would never run there,
// and one in two would run twice. Prints a GitHub error for each file that is not,
// and exits non-zero; prints the count per project otherwise.
//
//   node scripts/unit-projects.mjs
import { execFileSync } from 'node:child_process';
import { globSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url)).replaceAll('\\', '/');
const vitest = fileURLToPath(new URL('../node_modules/vitest/vitest.mjs', import.meta.url));

const listed = JSON.parse(
  execFileSync(process.execPath, [vitest, 'list', '--filesOnly', '--json'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  })
);

/** Each file, from the repository's root, and the projects that hold it. */
const projectsOf = new Map();
for (const file of globSync('tests/unit/**/*.test.{ts,tsx}', { cwd: root })) {
  projectsOf.set(file.replaceAll('\\', '/'), []);
}
for (const { file, projectName } of listed) {
  const path = file.replaceAll('\\', '/').replace(`${root.replace(/\/$/, '')}/`, '');
  if (!projectsOf.has(path)) projectsOf.set(path, []);
  projectsOf.get(path).push(projectName ?? '(none)');
}

let wrong = 0;
const counts = {};
for (const [file, projects] of projectsOf) {
  if (projects.length !== 1) {
    console.log(
      `::error file=${file}::${file} is in ${projects.length} unit test projects` +
        (projects.length ? ` (${projects.join(', ')})` : '') +
        ', not 1 (vitest.config.mts)'
    );
    wrong++;
  } else counts[projects[0]] = (counts[projects[0]] ?? 0) + 1;
}
if (wrong) process.exitCode = 1;
else {
  const summary = Object.entries(counts)
    .map(([name, n]) => `${name} ${n}`)
    .join(', ');
  console.log(`${projectsOf.size} unit test files, each in one project: ${summary}`);
}
