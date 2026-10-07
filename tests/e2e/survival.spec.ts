import { type Page, devices, expect, test } from '@playwright/test';
import { SURVIVAL_BEST_KEY } from '@/app/ui/xenocats/arena-storage';

// Survival, the arena, on /cats/survival (no login, no database). The canvas cannot
// be read, so the tests read the run's state from the play area's data- attributes
// and the HUD's text. `?seed=` fixes the run; `?speed=` makes time pass faster.

const area = (page: Page) => page.getByTestId('survival-area');
const num = async (page: Page, name: string) => Number(await area(page).getAttribute(name));

async function openArena(page: Page, query = '?seed=7') {
  await page.goto('/cats/survival' + query);
  await expect(page.getByRole('heading', { level: 1, name: 'Survival' })).toBeVisible();
}

/** Starts a run; a click before hydration is lost, so click until it starts. */
async function startRun(page: Page, tap = false) {
  await expect
    .poll(async () => {
      if ((await area(page).count()) === 0) {
        const button = page.getByTestId('survival-start');
        if (tap) await button.tap();
        else await button.click();
      }
      return area(page).count();
    })
    .toBe(1);
  await expect(area(page)).toHaveAttribute('data-screen', 'playing');
}

test.describe('on a computer', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('a run: time passes, the Laser Pointer sends cats home, Esc pauses, giving up shows the results and keeps the best time', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await openArena(page, '?seed=7&speed=3');
    await expect(page.getByTestId('survival-best')).toHaveText('Longest survived: none yet');
    // No ambient cats and no fake cursor on the game's page.
    await expect(page.getByTestId('xenocat')).toHaveCount(0);
    await startRun(page);
    await expect(area(page)).toHaveAttribute('data-weapons', 'laser-pointer');
    expect(await page.locator('html').getAttribute('class')).not.toContain('xenocat-cursor-hidden');
    // The canvas is hidden from assistive technology; the HUD is text.
    await expect(page.locator('canvas')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.getByTestId('survival-time')).toContainText('/ 5:00');

    // Cats come, and the laser sends them home on its own.
    await expect.poll(() => num(page, 'data-time'), { timeout: 10_000 }).toBeGreaterThan(2000);
    await expect.poll(() => num(page, 'data-cats'), { timeout: 10_000 }).toBeGreaterThan(0);
    await expect.poll(() => num(page, 'data-sent-home'), { timeout: 30_000 }).toBeGreaterThan(0);
    await expect(page.getByTestId('survival-sent-home')).not.toHaveText('Cats sent home: 0');

    // Esc pauses: a dialog, focus on Resume, and time stands still.
    await page.keyboard.press('Escape');
    const paused = page.getByRole('dialog', { name: 'Paused' });
    await expect(paused).toBeVisible();
    await expect(paused.getByRole('button', { name: 'Resume' })).toBeFocused();
    const stopped = await num(page, 'data-time');
    await page.waitForTimeout(600);
    expect(await num(page, 'data-time')).toBe(stopped);
    await paused.getByRole('button', { name: 'Resume' }).click();
    await expect.poll(() => num(page, 'data-time')).toBeGreaterThan(stopped);

    // Giving up ends the run: the results, and the best time kept.
    await page.keyboard.press('Escape');
    await page
      .getByRole('dialog', { name: 'Paused' })
      .getByRole('button', { name: 'Give up' })
      .click();
    const results = page.getByTestId('survival-results');
    await expect(results).toHaveAttribute('data-outcome', 'gave-up');
    await expect(results.getByRole('heading', { name: 'The run is over' })).toBeVisible();
    await expect(page.getByTestId('survival-result-time')).toHaveText(/^\d:\d\d$/);
    expect(
      Number(await page.getByTestId('survival-result-sent-home').textContent())
    ).toBeGreaterThan(0);
    await expect(results.getByRole('button', { name: 'Play again' })).toBeFocused();
    await expect(area(page)).toHaveCount(0);
    const stored = Number(
      await page.evaluate((key) => localStorage.getItem(key), SURVIVAL_BEST_KEY)
    );
    expect(stored).toBeGreaterThan(0);
    await page.reload();
    await expect(page.getByTestId('survival-best')).toHaveAttribute('data-best', String(stored));
    await expect(page.getByTestId('survival-best')).not.toHaveText('Longest survived: none yet');
  });

  test('WASD walks the hero', async ({ page }) => {
    await openArena(page);
    await startRun(page);
    await expect.poll(() => num(page, 'data-time')).toBeGreaterThan(300);
    const x0 = await num(page, 'data-hero-x');
    await page.keyboard.down('d');
    await expect.poll(() => num(page, 'data-hero-x')).toBeGreaterThan(x0 + 60);
    await page.keyboard.up('d');
    const x1 = await num(page, 'data-hero-x');
    await page.keyboard.down('ArrowLeft');
    await expect.poll(() => num(page, 'data-hero-x')).toBeLessThan(x1 - 60);
    await page.keyboard.up('ArrowLeft');
  });

  test('losing focus pauses the run', async ({ page }) => {
    await openArena(page);
    await startRun(page);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await expect(area(page)).toHaveAttribute('data-screen', 'paused');
    await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible();
  });
});

test.describe('on a touch screen', () => {
  // A phone's screen and touch input (its browser type cannot change inside a group).
  const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices['Pixel 7'];
  test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });

  test('the movement pad walks the hero, the laser sends cats home, and Pause leads to giving up', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await openArena(page, '?seed=7&speed=3');
    await startRun(page, true);
    const pad = page.getByTestId('movement-pad');
    await expect(pad).toBeVisible();
    const box = (await pad.boundingBox())!;
    const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const x0 = await num(page, 'data-hero-x');
    // A thumb on the pad, pushed to the right, then lifted.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: centre.x + 50, y: centre.y }],
    });
    await expect.poll(() => num(page, 'data-hero-x')).toBeGreaterThan(x0 + 60);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => num(page, 'data-sent-home'), { timeout: 30_000 }).toBeGreaterThan(0);
    await area(page).getByRole('button', { name: 'Pause' }).tap();
    await page
      .getByRole('dialog', { name: 'Paused' })
      .getByRole('button', { name: 'Give up' })
      .tap();
    await expect(page.getByTestId('survival-results')).toHaveAttribute('data-outcome', 'gave-up');
  });
});
