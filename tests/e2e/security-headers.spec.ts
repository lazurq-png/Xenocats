import { type Page, expect, test } from '@playwright/test';

// The security headers from next.config.ts: present on every page, and strict
// enough to matter, yet the pages still work under them. The rest of the suite
// runs under the same policy, cats, sounds and forms included.

test('every page response carries the security headers', async ({ request }) => {
  for (const path of ['/', '/login', '/cats', '/dashboard']) {
    const response = await request.get(path, { maxRedirects: 0 });
    const headers = response.headers();
    const csp = headers['content-security-policy'] ?? '';
    expect(csp, path).toContain("default-src 'self'");
    expect(csp, path).toContain("object-src 'none'");
    expect(csp, path).toContain("frame-ancestors 'none'");
    expect(csp, path).toContain("base-uri 'self'");
    expect(headers['x-content-type-options'], path).toBe('nosniff');
    expect(headers['x-frame-options'], path).toBe('DENY');
    expect(headers['referrer-policy'], path).toBe('strict-origin-when-cross-origin');
    expect(headers['strict-transport-security'], path).toMatch(/max-age=\d+/);
    expect(headers['permissions-policy'], path).toContain('camera=()');
  }
});

/**
 * Collects what the browser reports when the policy blocks something: the DOM's
 * `securitypolicyviolation` event (relayed to the console from every page), and
 * Chrome's own console report as a second witness.
 */
async function watchForViolations(page: Page) {
  const violations: string[] = [];
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      console.error(`CSP violation: ${event.violatedDirective} ${event.blockedURI}`);
    });
  });
  page.on('console', (message) => {
    const text = message.text();
    if (text.includes('CSP violation') || text.includes('Content Security Policy')) {
      violations.push(text);
    }
  });
  page.on('pageerror', (error) => violations.push(`page error: ${error.message}`));
  return violations;
}

test('the public pages run under the policy: scripts and styles', async ({ page }) => {
  const violations = await watchForViolations(page);
  await page.goto('/');
  await expect(page.getByRole('link', { name: /log in/i }).first()).toBeVisible();
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  // Hydrated: the client-side password toggle works.
  const toggle = page.getByRole('button', { name: 'Show password' });
  await toggle.click();
  await expect(page.getByRole('button', { name: 'Hide password' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  expect(violations).toEqual([]);
});

test('logged in, the dashboard pages run under the policy', async ({ page }) => {
  test.skip(!process.env.E2E_POSTGRES_URL, 'needs a database (POSTGRES_URL)');
  const violations = await watchForViolations(page);
  await page.goto('/login');
  await page.getByLabel('Email').fill('user@nextmail.com');
  await page.getByLabel('Password', { exact: true }).fill('123456');
  await page.getByRole('button', { name: /log in/i }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
  for (const [path, heading] of [
    ['/dashboard', /captain/i],
    ['/dashboard/invoices', /^invoices$/i],
    ['/dashboard/customers', /^customers$/i],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    // The cats' layer: client code that draws with inline styles.
    await expect(page.getByTestId('xenocat-page')).toBeAttached();
    await page.waitForLoadState('networkidle');
  }
  // A client-side interaction: the search box updates the URL.
  await page.getByPlaceholder(/search/i).fill('Amy');
  await expect(page).toHaveURL(/query=Amy/);
  expect(violations).toEqual([]);
});

test('the cats run under the policy: a summoned cat appears, drawn with inline styles', async ({
  page,
}) => {
  const violations = await watchForViolations(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/cats');
  await expect(page.getByRole('heading', { name: 'The cats' })).toBeVisible();
  await page.waitForLoadState('networkidle');
  // Asleep, so it stays put and does nothing to the cursor while the test looks.
  const summon = page.getByTestId('summon-asleep-void-tabby');
  await summon.scrollIntoViewIfNeeded();
  await summon.click();
  await expect(page.getByTestId('xenocat')).toBeVisible();
  expect(violations).toEqual([]);
});

test('the policy blocks an outside image, and the watcher above sees it', async ({ page }) => {
  const violations = await watchForViolations(page);
  await page.goto('/login');
  await page.evaluate(() => {
    const image = document.createElement('img');
    image.src = 'https://example.com/tracker.png';
    document.body.append(image);
  });
  await expect.poll(() => violations.join('\n')).toContain('CSP violation: img-src');
});
