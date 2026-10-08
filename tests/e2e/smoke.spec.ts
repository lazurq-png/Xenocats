import { expect, test } from '@playwright/test';

// Pages that render without the database; dashboard.spec.ts covers those that need it.

test('home page renders and links to the login page', async ({ page }) => {
  await page.goto('/');
  // The hero's link (the header has only the logo).
  const login = page.getByRole('main').getByRole('link', { name: 'Log in' });
  await expect(login).toBeVisible();
  await login.click();
  await expect(page).toHaveURL(/\/login$/);
});

test('login page renders the sign-in form', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Welcome back, stargazer.' })).toBeVisible();
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /log in/i })).toBeVisible();
});

test('the password can be shown and hidden again', async ({ page }) => {
  await page.goto('/login');
  const password = page.getByLabel('Password', { exact: true });
  await password.fill('stardust');
  await expect(password).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'Show password' }).click();
  await expect(password).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Hide password' }).click();
  await expect(password).toHaveAttribute('type', 'password');
});

for (const [width, height] of [
  [1280, 800],
  [390, 844],
]) {
  test(`at ${width} px the home page has one Log in and one Meet the cats link, both in the hero`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    const login = page.getByRole('link', { name: 'Log in' });
    const cats = page.getByRole('link', { name: 'Meet the cats' });
    await expect(login).toHaveCount(1);
    await expect(cats).toHaveCount(1);
    // Both in the hero, under the page's main heading, and visible.
    await expect(page.getByRole('main').getByRole('link', { name: 'Log in' })).toBeVisible();
    await expect(page.getByRole('main').getByRole('link', { name: 'Meet the cats' })).toBeVisible();
    await expect(page.getByRole('banner').getByRole('link')).toHaveCount(1); // the logo
    await expect(login).toHaveAttribute('href', '/login');
    await expect(cats).toHaveAttribute('href', '/cats');
  });
}

test('the dashboard sends a visitor without a session to the login page', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
});
