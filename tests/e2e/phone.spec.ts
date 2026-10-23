import { type Page, devices, expect, test } from './fixtures';
import { DEMO_USER } from './demo-user';

// Every page on a phone: nothing wider than the screen, and every link, button and
// field easy to tap with a finger. A control smaller than 40 px either way has a tap
// area (the `tap-area` utility, or its label) reaching 44 px round its middle. The cats
// are paused (fixtures.ts), so none covers what is measured.

const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices['Pixel 7'];
test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });

/** What on the page is too wide, or too small to tap: empty when the page is fine. */
async function phoneProblems(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const problems: string[] = [];
    const root = document.documentElement;
    if (root.scrollWidth > root.clientWidth + 1) {
      problems.push(`the page is ${root.scrollWidth} px wide on a ${root.clientWidth} px screen`);
    }
    const hidden = (el: Element) => {
      for (let n: Element | null = el; n; n = n.parentElement) {
        const style = getComputedStyle(n);
        if (style.display === 'none' || style.visibility === 'hidden') return true;
        // Seen only by screen readers (sr-only clips it to nothing).
        if (style.clip && style.clip !== 'auto') return true;
        if (style.clipPath && style.clipPath !== 'none') return true;
      }
      const box = el.getBoundingClientRect();
      return box.width === 0 || box.height === 0;
    };
    const controls = [
      ...document.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea'),
    ].filter((el) => !hidden(el) && !(el instanceof HTMLInputElement && el.type === 'hidden'));
    const name = (el: Element) =>
      `${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') || el.textContent || el.getAttribute('name') || '').trim().slice(0, 40)}"`;
    for (const control of controls) {
      // A radio or a checkbox is tapped by its label.
      const target =
        control instanceof HTMLInputElement && ['radio', 'checkbox'].includes(control.type)
          ? (control.closest('label') ?? control)
          : control;
      target.scrollIntoView({ block: 'center', inline: 'center' });
      await new Promise((done) => requestAnimationFrame(done));
      const box = target.getBoundingClientRect();
      const x = box.left + box.width / 2;
      const y = box.top + box.height / 2;
      // Where a finger at the edge of a 44 px area lands, each way it is under 40 px.
      const probes: [number, number][] = [];
      if (box.height < 40) probes.push([x, y - 21], [x, y + 21]);
      if (box.width < 40) probes.push([x - 21, y], [x + 21, y]);
      for (const [px, py] of probes) {
        const hit = document.elementFromPoint(px, py);
        if (!hit || !(target.contains(hit) || control.contains(hit))) {
          problems.push(
            `${name(control)} is ${Math.round(box.width)}×${Math.round(box.height)} px, and a tap at ${Math.round(px - x)},${Math.round(py - y)} from its middle misses it`
          );
          break;
        }
      }
    }
    return problems;
  });
}

test('the public pages fit a phone, and everything on them is easy to tap', async ({ page }) => {
  for (const path of ['/', '/login', '/signup', '/cats', '/cats/survival']) {
    await page.goto(path);
    await expect(page.locator('main, form').first()).toBeVisible();
    // The game's page renders for a computer first, and swaps to a phone's once it runs.
    if (path === '/cats/survival') await expect(page.getByText('Walk with the pad')).toBeVisible();
    expect(await phoneProblems(page), path).toEqual([]);
  }
});

test.describe('signed in', () => {
  test.skip(!process.env.E2E_POSTGRES_URL, 'needs a database (POSTGRES_URL)');
  test.use({ storageState: DEMO_USER });

  test('the dashboard pages fit a phone, and everything on them is easy to tap', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const pages = [
      '/dashboard',
      '/dashboard/invoices',
      '/dashboard/invoices/create',
      '/dashboard/customers',
      '/dashboard/customers/create',
      '/dashboard/settings',
    ];
    for (const path of pages) {
      await page.goto(path);
      await expect(page.locator('main').first()).toBeVisible();
      await page.waitForLoadState('load');
      expect(await phoneProblems(page), path).toEqual([]);
    }
    // An invoice of the list, on its own page.
    await page.goto('/dashboard/invoices');
    const view = page.getByRole('link', { name: /^View / }).first();
    await view.click();
    await expect(page).toHaveURL(/\/dashboard\/invoices\/[0-9a-f-]+$/);
    expect(await phoneProblems(page), 'an invoice').toEqual([]);
  });
});
