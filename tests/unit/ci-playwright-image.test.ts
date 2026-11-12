import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// CI's browser jobs run in Microsoft's Playwright image, whose Chromium and system
// libraries are those of one Playwright version: its tag must be the version of
// @playwright/test in package-lock.json (ci.yml says so where it names the image).
// Dependabot's weekly npm update moves the lockfile but not the image, which it does
// not update; this fails until both are moved together.

const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8')) as {
  packages: Record<string, { version?: string }>;
};

describe("CI's Playwright image", () => {
  it('is the locked @playwright/test version, in every job that uses it', () => {
    const locked = lock.packages['node_modules/@playwright/test']?.version;
    expect(locked, '@playwright/test in package-lock.json').toMatch(/^\d+\.\d+\.\d+$/);
    const tags = [...workflow.matchAll(/mcr\.microsoft\.com\/playwright:v([^\s-]+)-\w+/g)].map(
      ([, version]) => version
    );
    // The build and e2e jobs.
    expect(tags.length, 'Playwright images named in ci.yml').toBeGreaterThanOrEqual(2);
    for (const tag of tags) {
      expect(
        tag,
        `ci.yml's image is v${tag}; package-lock.json has @playwright/test ${locked}: move every image tag in ci.yml to v${locked}`
      ).toBe(locked);
    }
  });
});
