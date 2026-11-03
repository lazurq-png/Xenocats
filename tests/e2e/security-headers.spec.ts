import { type Page, expect, test } from './fixtures';
import { DEMO_USER } from './demo-user';

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
    expect(headers['cross-origin-opener-policy'], path).toBe('same-origin');
    // And none saying what serves it.
    expect(headers['x-powered-by'], path).toBeUndefined();
  }
});

// The opener policy as the browser applies it: a page of no site (about:blank, which
// sets no policy of its own, so only this site's can cut the link) opens the login
// page in a popup, and the two get no handle on each other.
test('a page of another site that opens this one gets no handle on its window', async ({
  page,
  baseURL,
}) => {
  await page.goto('about:blank');
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.evaluate((url) => void window.open(url), new URL('/login', baseURL).href),
  ]);
  await popup.waitForLoadState('domcontentloaded');
  await expect(popup).toHaveURL(/\/login/);
  expect(await popup.evaluate(() => window.opener === null)).toBe(true);
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

test.describe('logged in', () => {
  test.skip(!process.env.E2E_POSTGRES_URL, 'needs a database (POSTGRES_URL)');
  test.use({ storageState: DEMO_USER });

  test('the dashboard pages run under the policy', async ({ page }) => {
    const violations = await watchForViolations(page);
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

  // Every page behind the login shows the account's own data: no cache between the
  // visitor and the site (a CDN's, a proxy's) may keep one to hand to someone else. They
  // say so because they are rendered for each request; a page made static, or cached
  // for a while, would lose it. (The CSV export's own header: export-route.test.ts.)
  // It proves that under `next start` only (CI's build job, E2E_SERVER=start): `next dev`
  // sends no-store on every page, whatever the page is.
  test('no page behind the login may be kept by a cache', async ({ request }) => {
    const list = async (path: string, link: RegExp) => {
      const html = await (await request.get(path)).text();
      const found = html.match(link)?.[0];
      expect(found, `a link in ${path}`).toBeTruthy();
      return found!;
    };
    const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
    // A seeded customer's, which no other test deletes (the invoice tests delete their own).
    const invoice = await list(
      '/dashboard/invoices?query=Evil%20Rabbit',
      new RegExp(`/dashboard/invoices/${uuid}`)
    );
    const customer = await list(
      '/dashboard/customers?query=Evil%20Rabbit',
      new RegExp(`/dashboard/customers/${uuid}/edit`)
    );
    for (const path of [
      '/dashboard',
      '/dashboard/invoices',
      '/dashboard/invoices/create',
      invoice,
      `${invoice}/edit`,
      '/dashboard/customers',
      '/dashboard/customers/create',
      customer,
      '/dashboard/settings',
    ]) {
      const response = await request.get(path, { maxRedirects: 0 });
      // The page itself, signed in: not a redirect to the login, which proves nothing.
      expect(response.status(), path).toBe(200);
      expect(response.headers()['cache-control'], path).toMatch(/\bno-store\b/);
    }
  });
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

// The policy's scripts are allowed by a nonce, new on every request (proxy.ts,
// app/lib/csp.ts), not by 'unsafe-inline': every script the page itself sends
// carries it, and one injected without it does not run.
test('scripts run by a nonce of their own, new on every request, on every script the page sends', async ({
  request,
}) => {
  const nonceOf = (csp: string) => /'nonce-([A-Za-z0-9+/=]+)'/.exec(csp)?.[1];
  const seen = new Set<string>();
  for (const path of ['/', '/login', '/cats', '/cats/survival']) {
    const response = await request.get(path);
    const csp = response.headers()['content-security-policy'] ?? '';
    const scriptSrc = csp.split('; ').find((d) => d.startsWith('script-src ')) ?? '';
    expect(scriptSrc, path).toContain("'strict-dynamic'");
    expect(scriptSrc, path).not.toContain("'unsafe-inline'");
    const nonce = nonceOf(csp);
    expect(nonce, path).toBeTruthy();
    seen.add(nonce!);
    // Every <script> in the page, inline or not, carries this response's nonce.
    const html = await response.text();
    const scripts = html.match(/<script\b[^>]*>/g) ?? [];
    expect(scripts.length, path).toBeGreaterThan(0);
    for (const tag of scripts) expect(tag, path).toContain(`nonce="${nonce}"`);
  }
  // A new nonce each time.
  expect(seen.size).toBe(4);
});

// What an injection looks like: markup with a script in an attribute. Without
// 'unsafe-inline' it does not run. ('strict-dynamic' does let a script that page code
// creates with createElement run, by design: that is code already running.)
test('an injected inline handler does not run, and the watcher above sees it', async ({ page }) => {
  const violations = await watchForViolations(page);
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => {
    document.body.insertAdjacentHTML(
      'beforeend',
      '<img src="/no-such-image.png" onerror="window.__injected = true">'
    );
  });
  await expect.poll(() => violations.join(' ')).toMatch(/CSP violation: script-src/);
  expect(
    await page.evaluate(() => (window as { __injected?: boolean }).__injected)
  ).toBeUndefined();
});
