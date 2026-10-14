import { type Page, expect, test } from './fixtures';

// Survival's leaderboard: a run is named at its end and put on its length's board,
// which /cats shows with the player's personal best. Signed out, or with a hook that
// changes the game or its clock (`?speed=`), it is not. `?seed=` fixes the run; a
// ranked run plays in real time, as the server holds it to.

const area = (page: Page) => page.getByTestId('survival-area');

/** Starts a run; a click before hydration is lost, so click until it starts. */
async function startRun(page: Page) {
  await expect
    .poll(
      async () => {
        if ((await area(page).count()) === 0) await page.getByTestId('survival-start').click();
        return area(page).count();
      },
      { timeout: 15_000 }
    )
    .toBe(1);
}

/** Plays until `ms` of the run have passed, then gives up: the results. */
async function playThenGiveUp(page: Page, ms = 1500) {
  await expect
    .poll(
      async () => {
        // A level-up waiting for a choice stops the run: take the first.
        if ((await page.getByTestId('survival-level-up').count()) > 0) {
          await page.keyboard.press('1');
        }
        return Number(await area(page).getAttribute('data-time'));
      },
      { timeout: 15_000 }
    )
    .toBeGreaterThan(ms);
  const paused = page.getByRole('dialog', { name: 'Paused' });
  await expect
    .poll(async () => {
      if ((await page.getByTestId('survival-level-up').count()) > 0) {
        await page.keyboard.press('1');
      }
      if ((await paused.count()) === 0) await page.keyboard.press('Escape');
      return paused.count();
    })
    .toBe(1);
  await paused.getByRole('button', { name: 'Give up' }).click();
  await expect(page.getByTestId('survival-results')).toBeVisible();
}

test('signed out, the run is not saved: the results offer a login, and Play again has focus', async ({
  page,
}) => {
  await page.goto('/cats/survival?seed=7');
  await startRun(page);
  await playThenGiveUp(page);
  const entry = page.getByTestId('leaderboard-entry');
  await expect(entry).toContainText('to put your runs on the leaderboard');
  await expect(entry.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login');
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Play again' }).last()).toBeFocused();
});

test('a run with a hook that changes the game or its clock is not ranked', async ({ page }) => {
  await page.goto('/cats/survival?seed=7&speed=3');
  await startRun(page);
  await playThenGiveUp(page);
  await expect(page.getByTestId('leaderboard-entry')).toHaveText(
    'A run with test settings is not ranked on the leaderboard.'
  );
});

test.describe('signed in', () => {
  test.skip(!process.env.E2E_POSTGRES_URL, 'needs a database (POSTGRES_URL)');

  test('a 10-minute run is named at its end and shows on the 10-minute board on /cats', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    // An account of the test's own, so its run is the only one under this name.
    const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
    await page.goto('/signup');
    await page.waitForLoadState('networkidle');
    await page.getByLabel('Username').fill(`board${stamp}`);
    await page.getByLabel('Password', { exact: true }).fill('a-good-password');
    await page.getByLabel('Password again').fill('a-good-password');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });

    await page.goto('/cats/survival?seed=7');
    await page.waitForLoadState('networkidle');
    await page.getByTestId('survival-length-10').check();
    await startRun(page);
    await playThenGiveUp(page);

    // The name field has focus; the name is the player's own choice, not the username.
    const name = page.getByLabel('Your name on the 10-minute leaderboard');
    await expect(name).toBeFocused();
    const typed = `Comet ${stamp}`;
    await name.fill(typed);
    await page.getByRole('button', { name: 'Save to the leaderboard' }).click();
    await expect(page.getByTestId('leaderboard-entry')).toContainText(
      `On the 10-minute leaderboard as ${typed}.`
    );
    const time = (await page.getByTestId('survival-result-time').textContent())!;

    await page.goto('/cats');
    const board = page.getByTestId('leaderboard-10');
    const row = board.getByRole('row').filter({ hasText: typed });
    await expect(row).toHaveCount(1);
    await expect(row).toHaveAttribute('aria-current', 'true');
    await expect(row).toContainText(time);
    await expect(page.getByTestId('leaderboard-5').getByText(typed)).toHaveCount(0);
    await expect(page.getByTestId('leaderboard-15').getByText(typed)).toHaveCount(0);
    // The player's personal best of each length.
    await expect(page.getByTestId('personal-best-10')).toContainText(`${time}`);
    await expect(page.getByTestId('personal-best-10')).toContainText(`as ${typed}`);
    await expect(page.getByTestId('personal-best-5')).toHaveText(
      'Your best: no run of this length yet.'
    );
  });
});
