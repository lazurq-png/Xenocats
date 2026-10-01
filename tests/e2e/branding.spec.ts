import { expect, test } from '@playwright/test';

// The site is Xenocat Analytics everywhere a visitor can see without logging in.

for (const [path, title] of [
  ['/', 'Xenocat Analytics'],
  ['/login', 'Xenocat Analytics'],
  ['/cats', 'Cats | Xenocat Analytics'],
] as const) {
  test(`${path} is branded Xenocat Analytics, with no trace of Acme`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveTitle(title);
    const text = await page.locator('body').innerText();
    expect(text).not.toMatch(/acme/i);
  });
}

test('the home and login pages show the Xenocat logo', async ({ page }) => {
  for (const path of ['/', '/login']) {
    await page.goto(path);
    await expect(page.getByText('Xenocat', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Analytics', { exact: true }).first()).toBeVisible();
  }
});

test('the home page links to the cats', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('main').getByRole('link', { name: 'Meet the cats' }).click();
  await expect(page).toHaveURL(/\/cats$/);
  await expect(page.getByRole('heading', { name: 'The cats' })).toBeVisible();
});

test('the site icon is the Xenocat mark', async ({ page }) => {
  await page.goto('/');
  const href = await page.locator('link[rel="icon"][type="image/svg+xml"]').getAttribute('href');
  expect(href).toBeTruthy();
  const icon = await page.request.get(href!);
  expect(icon.ok()).toBe(true);
  expect(await icon.text()).toContain('<svg');
});
