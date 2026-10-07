import { type Page, devices, expect, test } from '@playwright/test';
import { SURVIVAL_BEST_KEY } from '@/app/ui/xenocats/arena-storage';

// Survival, the arena, on /cats/survival (no login, no database). The canvas cannot
// be read, so the tests read the run's state from the play area's data- attributes
// and the HUD's text. `?seed=` fixes the run; `?speed=` makes time pass faster.

const area = (page: Page) => page.getByTestId('survival-area');
const levelUp = (page: Page) => page.getByTestId('survival-level-up');

/**
 * A level-up waiting for a choice stops the run; a test of something else takes
 * the first choice and plays on.
 */
async function playOn(page: Page, tap = false) {
  if ((await levelUp(page).count()) === 0) return;
  if (tap) await levelUp(page).getByRole('button').first().tap();
  else await page.keyboard.press('1');
}

const num = async (page: Page, name: string) => {
  await playOn(page);
  return Number(await area(page).getAttribute(name));
};

/** Pauses the run with Esc (taking any level-up's choice first). */
async function pauseRun(page: Page) {
  const paused = page.getByRole('dialog', { name: 'Paused' });
  await expect
    .poll(async () => {
      await playOn(page);
      if ((await paused.count()) === 0) await page.keyboard.press('Escape');
      return paused.count();
    })
    .toBe(1);
  return paused;
}

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
    await expect(area(page)).toHaveAttribute('data-weapons', 'laser-pointer:1');
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
    const paused = await pauseRun(page);
    await expect(paused.getByRole('button', { name: 'Resume' })).toBeFocused();
    const stopped = await num(page, 'data-time');
    await page.waitForTimeout(600);
    expect(await num(page, 'data-time')).toBe(stopped);
    await paused.getByRole('button', { name: 'Resume' }).click();
    await expect.poll(() => num(page, 'data-time')).toBeGreaterThan(stopped);

    // Giving up ends the run: the results, and the best time kept.
    await (await pauseRun(page)).getByRole('button', { name: 'Give up' }).click();
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

  test('a level-up stops the run for a choice, made with a number key; the run goes on with it', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await openArena(page, '?seed=7&speed=6');
    await startRun(page);
    await expect(area(page)).toHaveAttribute('data-level', '1');
    // He walks about, gathering what the laser leaves.
    await page.keyboard.down('d');
    const dialog = levelUp(page);
    await expect(dialog).toBeVisible({ timeout: 40_000 });
    await page.keyboard.up('d');
    await expect(dialog.getByRole('heading', { name: /Level 2\. Choose one\./ })).toBeVisible();
    await expect(area(page)).toHaveAttribute('data-screen', 'choosing');
    // Focus in the dialog, on the first choice; the arrow keys move it.
    const buttons = dialog.getByRole('button');
    await expect(buttons.first()).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(buttons.nth(1)).toBeFocused();
    // The run waits.
    const waited = await area(page).getAttribute('data-time');
    await page.waitForTimeout(500);
    expect(await area(page).getAttribute('data-time')).toBe(waited);
    // A new weapon, by its number.
    const kinds = await buttons.evaluateAll((all) => all.map((b) => b.getAttribute('data-kind')));
    const pick = Math.max(kinds.indexOf('weapon'), 0);
    const chosen = await buttons.nth(pick).getAttribute('data-choice');
    const chosenLevel = await buttons.nth(pick).getAttribute('data-level');
    await page.keyboard.press(String(pick + 1));
    // Held at the level chosen (a further choice may raise it).
    if (kinds[pick] === 'weapon') {
      await expect
        .poll(async () => {
          const held = (await area(page).getAttribute('data-weapons')) ?? '';
          const level = new RegExp(`${chosen}:(\\d)`).exec(held)?.[1];
          return Number(level ?? 0);
        })
        .toBeGreaterThanOrEqual(Number(chosenLevel));
    }
    // Another level (or a chest) may be waiting already: take those, and play on.
    await expect
      .poll(async () => {
        await playOn(page);
        return area(page).getAttribute('data-screen');
      })
      .toBe('playing');
    await expect(dialog).toHaveCount(0);
    await expect(area(page)).toBeFocused();
    await expect.poll(() => num(page, 'data-time')).toBeGreaterThan(Number(waited));
    expect(await num(page, 'data-level')).toBeGreaterThanOrEqual(2);
  });

  test('a Mega Cat arrives, its Homesickness shown in a bar of its own', async ({ page }) => {
    test.setTimeout(60_000);
    // `?boss=3`: a Mega Cat at three seconds, besides the schedule's.
    await openArena(page, '?seed=7&speed=2&boss=3');
    await startRun(page);
    await expect(area(page)).toHaveAttribute('data-boss', '');
    const bar = page.getByTestId('survival-boss');
    await expect
      .poll(
        async () => {
          await playOn(page);
          return bar.count();
        },
        { timeout: 30_000 }
      )
      .toBe(1);
    await expect(bar).toContainText('Mega Cat');
    const meter = bar.getByRole('meter', { name: 'Mega Cat' });
    await expect(meter).toHaveAttribute('aria-valuemax', '4500');
    await expect(meter).toHaveAttribute('aria-valuetext', /^Homesickness \d+%$/);
    expect(await area(page).getAttribute('data-boss')).not.toBe('');
  });

  test('losing focus pauses the run', async ({ page }) => {
    await openArena(page);
    await startRun(page);
    await playOn(page);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await expect(area(page)).toHaveAttribute('data-screen', 'paused');
    await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible();
  });
});

test.describe('on a touch screen', () => {
  // A phone's screen and touch input (its browser type cannot change inside a group).
  const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices['Pixel 7'];
  test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });

  test('a level-up choice is made with a tap', async ({ page }) => {
    test.setTimeout(60_000);
    await openArena(page, '?seed=7&speed=6');
    await startRun(page, true);
    const pad = page.getByTestId('movement-pad');
    const box = (await pad.boundingBox())!;
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: box.x + box.width / 2 + 50, y: box.y + box.height / 2 }],
    });
    const dialog = levelUp(page);
    await expect(dialog).toBeVisible({ timeout: 40_000 });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(dialog).toContainText('Tap a choice.');
    const buttons = dialog.getByRole('button');
    const kinds = await buttons.evaluateAll((all) => all.map((b) => b.getAttribute('data-kind')));
    const pick = Math.max(kinds.indexOf('weapon'), 0);
    const chosen = await buttons.nth(pick).getAttribute('data-choice');
    const chosenLevel = await buttons.nth(pick).getAttribute('data-level');
    await buttons.nth(pick).tap();
    await expect(dialog).toHaveCount(0);
    await expect(area(page)).toHaveAttribute('data-screen', 'playing');
    if (kinds[pick] === 'weapon') {
      await expect(area(page)).toHaveAttribute(
        'data-weapons',
        new RegExp(`${chosen}:${chosenLevel}`)
      );
    }
  });

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
    await playOn(page, true);
    await area(page).getByRole('button', { name: 'Pause' }).tap();
    await page
      .getByRole('dialog', { name: 'Paused' })
      .getByRole('button', { name: 'Give up' })
      .tap();
    await expect(page.getByTestId('survival-results')).toHaveAttribute('data-outcome', 'gave-up');
  });
});
