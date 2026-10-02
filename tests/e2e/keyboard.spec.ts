import { type Page, expect, test } from '@playwright/test';

// The dashboard and /cats by keyboard only: a skip link first, a visible focus
// ring on everything Tab reaches, and every control named. The cats never touch
// the keyboard (a plan-wide rule), so these tests do not wait for them to leave.

/**
 * Whether the focused element shows that it has focus the way the app draws it:
 * a solid, opaque outline at least 2px wide (the base :focus-visible rule, or a
 * control's own) — not the browser's default ring, nor Tailwind's transparent
 * `outline-none` — or, for a form field, its focus ring (a box-shadow).
 */
const focusShows = (page: Page) =>
  page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null;
    if (!element || element === document.body) return false;
    const style = getComputedStyle(element);
    const transparent = /rgba\([^)]*,\s*0\)$/.test(style.outlineColor);
    const outline =
      style.outlineStyle === 'solid' && parseFloat(style.outlineWidth) >= 2 && !transparent;
    const field = element.matches('input, select, textarea');
    return outline || (field && style.boxShadow !== 'none');
  });

const focused = (page: Page) =>
  page.evaluate(() => {
    const element = document.activeElement as HTMLElement;
    return {
      id: element.id,
      testId: element.dataset.testid ?? '',
      text: (element.getAttribute('aria-label') ?? element.textContent ?? '').trim(),
      tag: element.tagName,
    };
  });

/** Presses Tab until `match` holds for the focused element (each stop must show focus). */
async function tabTo(page: Page, match: (f: Awaited<ReturnType<typeof focused>>) => boolean) {
  for (let presses = 0; presses < 60; presses++) {
    await page.keyboard.press('Tab');
    expect(await focusShows(page), JSON.stringify(await focused(page))).toBe(true);
    if (match(await focused(page))) return;
  }
  throw new Error('Tab never reached the element');
}

/** The skip link comes first, shows itself on focus, and moves focus into the page. */
async function useSkipLink(page: Page) {
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to main content' });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  // It draws no focus style of its own: this is the base :focus-visible rule.
  expect(await focusShows(page)).toBe(true);
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await focused(page)).id).toBe('main-content');
}

/** Every visible link, button and field has an accessible name. */
async function expectEveryControlNamed(page: Page) {
  const controls = page.locator(
    'a[href]:visible, button:visible, input:not([type=hidden]):visible, select:visible, textarea:visible'
  );
  const count = await controls.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const control = controls.nth(i);
    const html = (await control.evaluate((element) => element.outerHTML)).slice(0, 200);
    await expect(control, `${page.url()}: ${html}`).toHaveAccessibleName(/\S/);
  }
}

test('/cats by keyboard: skip link, focus rings, and a cat summoned with Enter', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/cats');
  await page.waitForLoadState('networkidle');
  await useSkipLink(page);

  // From the cats' introduction, Tab reaches the first Summon button.
  await tabTo(page, (f) => f.testId.startsWith('summon-'));
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('xenocat')).toBeVisible();

  // With a cat on screen, the keyboard still moves focus.
  const before = await focused(page);
  await page.keyboard.press('Tab');
  expect(await focused(page)).not.toEqual(before);
  expect(await focusShows(page)).toBe(true);

  await expectEveryControlNamed(page);
});

test.describe('logged in', () => {
  test.skip(!process.env.E2E_POSTGRES_URL, 'needs a database (POSTGRES_URL)');

  test('the dashboard by keyboard: skip link, navigation and search', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await page.getByLabel('Email').fill('user@nextmail.com');
    await page.getByLabel('Password', { exact: true }).fill('123456');
    await page.getByLabel('Password', { exact: true }).press('Enter');
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // The skip link lands in the page, past the navigation.
    await useSkipLink(page);
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('#main-content'))).toBe(
      true
    );

    // From the top, the navigation leads to the invoices by Tab and Enter.
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await tabTo(page, (f) => f.tag === 'A' && f.text === 'Invoices');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/dashboard\/invoices$/);
    await page.waitForLoadState('networkidle');

    // And on to the search, typed into without the mouse.
    await tabTo(page, (f) => f.id === 'search');
    await page.keyboard.type('Amy');
    await expect(page).toHaveURL(/query=Amy/);
  });

  test('every control on the dashboard pages has a name', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await page.getByLabel('Email').fill('user@nextmail.com');
    await page.getByLabel('Password', { exact: true }).fill('123456');
    await page.getByRole('button', { name: /log in/i }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    for (const path of [
      '/dashboard',
      '/dashboard/invoices',
      '/dashboard/customers',
      '/dashboard/invoices/create',
      '/dashboard/settings',
    ]) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await expectEveryControlNamed(page);
    }

    // At phone width the navigation shows icons only: still named.
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of ['/dashboard', '/dashboard/invoices']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await expectEveryControlNamed(page);
    }
    await expect(page.getByRole('link', { name: 'Customers' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
  });
});
