import { expect, test } from '@playwright/test';

// Pages that render without the database. Nothing here submits a form: every
// Server Action runs against the project's only database.

test('home page renders and links to the login page', async ({ page }) => {
  await page.goto('/');
  // The header and the hero both link to the login page; this is the hero's.
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

test('the home page header links to the login page and the cats', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Main' });
  await expect(nav.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login');
  await expect(nav.getByRole('link', { name: 'Meet the cats' })).toHaveAttribute('href', '/cats');
});

test('the dashboard sends a visitor without a session to the login page', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
});
