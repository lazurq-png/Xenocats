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

/** A data- number once it has stopped changing (the HUD trails the run a little). */
async function settled(page: Page, name: string) {
  let last = NaN;
  await expect
    .poll(
      async () => {
        const now = await num(page, name);
        const same = now === last;
        last = now;
        return same;
      },
      { intervals: [300] }
    )
    .toBe(true);
  return last;
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

test('/cats has one Play link, and it opens Survival', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/cats');
  const fight = page.getByRole('region', { name: 'Fight a cat' });
  await expect(fight.getByRole('link')).toHaveCount(1);
  await fight.getByRole('link', { name: 'Play' }).click();
  await expect(page).toHaveURL(/\/cats\/survival$/, { timeout: 15_000 });
  await expect(page.getByRole('heading', { level: 1, name: 'Survival' })).toBeVisible();
  await expect(page.getByTestId('survival-start')).toBeVisible();
});

test('the retired Taming game is gone: /cats/taming is not found', async ({ page }) => {
  const response = await page.goto('/cats/taming');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1, name: '404 Not Found' })).toBeVisible();
});

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

  test('two Keepers at one keyboard: each walks with his own keys, and a level-up asks both in turn', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await openArena(page, '?seed=7&speed=6');
    // A click before hydration is lost: choose two until two are chosen.
    const two = page.getByTestId('survival-players-2');
    await expect
      .poll(async () => {
        await two.check();
        return page.getByTestId('survival-player2-character').count();
      })
      .toBe(1);
    await startRun(page);
    await expect(area(page)).toHaveAttribute('data-players', '2');
    await expect(page.getByRole('meter', { name: 'Player 2 Resolve' })).toBeVisible();
    await expect.poll(() => area(page).getAttribute('data-hero2-x')).not.toBe('');

    // Player 1 walks right with D; player 2 stays where he is.
    const x1 = await settled(page, 'data-hero-x');
    const x2 = await settled(page, 'data-hero2-x');
    await page.keyboard.down('d');
    await expect.poll(() => num(page, 'data-hero-x')).toBeGreaterThan(x1 + 40);
    await page.keyboard.up('d');
    expect(Math.abs((await settled(page, 'data-hero2-x')) - x2)).toBeLessThan(10);
    // Player 2 walks left with the left arrow; player 1 stays.
    const y1 = await settled(page, 'data-hero-x');
    await page.keyboard.down('ArrowLeft');
    await expect.poll(() => num(page, 'data-hero2-x')).toBeLessThan(x2 - 40);
    await page.keyboard.up('ArrowLeft');
    await settled(page, 'data-hero2-x');
    expect(Math.abs((await settled(page, 'data-hero-x')) - y1)).toBeLessThan(10);

    // A level-up: player 1 chooses, then player 2, for the same level.
    const dialog = levelUp(page);
    await page.keyboard.down('s');
    await expect(dialog).toBeVisible({ timeout: 40_000 });
    await page.keyboard.up('s');
    await expect(
      dialog.getByRole('heading', { name: /Level \d+\. Player 1, choose one\./ })
    ).toBeVisible();
    const level = (await dialog.getByRole('heading').textContent())?.match(/Level (\d+)/)?.[1];
    await expect(area(page)).toHaveAttribute('data-chooser', '0');
    await page.keyboard.press('1');
    await expect(
      dialog.getByRole('heading', { name: new RegExp(`Level ${level}\\. Player 2, choose one\\.`) })
    ).toBeVisible();
    await expect(area(page)).toHaveAttribute('data-chooser', '1');
    // A new dialog for the new turn: its name says whose, and focus is in it.
    await expect(page.getByRole('dialog', { name: /Player 2, choose one/ })).toBeVisible();
    await expect(dialog.getByRole('button').first()).toBeFocused();
    await page.keyboard.press('1');
    // Then the run goes on (taking any further level's choices, each in turn).
    await expect
      .poll(async () => {
        await playOn(page);
        return area(page).getAttribute('data-screen');
      })
      .toBe('playing');
  });

  test('a run gathers tufts of fur, kept after a reload', async ({ page }) => {
    test.setTimeout(60_000);
    await openArena(page, '?seed=7&speed=10');
    await expect(page.getByTestId('survival-tufts')).toHaveAttribute('data-tufts', '0');
    await startRun(page);
    // Half a minute of the run: at least six tufts for the time alone.
    await expect.poll(() => num(page, 'data-time'), { timeout: 20_000 }).toBeGreaterThan(30_000);
    await (await pauseRun(page)).getByRole('button', { name: 'Give up' }).click();
    const earned = Number(await page.getByTestId('survival-result-tufts').textContent());
    expect(earned).toBeGreaterThanOrEqual(6);
    await expect(page.getByTestId('survival-tufts')).toHaveAttribute('data-tufts', String(earned));
    await page.reload();
    await expect(page.getByTestId('survival-tufts')).toHaveAttribute('data-tufts', String(earned));
    await expect(page.getByTestId('survival-tufts')).toHaveText(`Tufts of fur: ${earned}`);
  });

  test('a character he has goes out with his own weapon; the codex shows what was found, ??? the rest', async ({
    page,
  }) => {
    await openArena(page);
    // A returning player: 2:00 survived (the Night Porter is his), one evolution found.
    await page.evaluate(() =>
      localStorage.setItem(
        'xenocats:survival:v1:progress',
        JSON.stringify({
          version: 1,
          tufts: 0,
          upgrades: {},
          milestones: ['survive-2'],
          bought: [],
          character: 'keeper',
          found: ['yarn-apocalypse'],
        })
      )
    );
    await page.reload();
    const porter = page.getByTestId('survival-character-night-porter');
    await expect(porter).toBeEnabled();
    // Not had: the Housekeeper is locked until engaged.
    await expect(page.getByTestId('survival-character-housekeeper')).toBeDisabled();
    // A click before hydration is lost: choose until chosen.
    await expect
      .poll(async () => {
        await porter.check();
        return porter.isChecked();
      })
      .toBe(true);
    const codex = page.getByTestId('survival-codex');
    await expect(codex.getByText('Yarn Apocalypse')).toBeVisible();
    // Six evolutions and the secret cat: one found, the rest unknown.
    await expect(codex.getByRole('listitem').filter({ hasText: '???' })).toHaveCount(6);
    // Kept after a reload; he goes out as the Night Porter, with the Spray Bottle.
    await page.reload();
    await expect(porter).toBeChecked();
    await startRun(page);
    await expect(area(page)).toHaveAttribute('data-weapons', 'spray-bottle:1');
  });

  test('the Tailor sells an upgrade for tufts; the next run begins with it', async ({ page }) => {
    await openArena(page);
    // Tufts from earlier nights.
    await page.evaluate(() =>
      localStorage.setItem(
        'xenocats:survival:v1:progress',
        JSON.stringify({ version: 1, tufts: 25, upgrades: {}, milestones: [], bought: [] })
      )
    );
    await page.reload();
    const tufts = page.getByTestId('survival-tufts');
    await expect(tufts).toHaveAttribute('data-tufts', '25');
    const stubbornness = page.getByTestId('survival-upgrade-stubbornness');
    // A click before hydration is lost: buy until it is bought.
    await expect
      .poll(async () => {
        if ((await stubbornness.getAttribute('data-level')) === '0') {
          await page.getByRole('button', { name: 'Buy Stubbornness level 1 for 10 tufts' }).click();
        }
        return stubbornness.getAttribute('data-level');
      })
      .toBe('1');
    await expect(tufts).toHaveAttribute('data-tufts', '15');
    // The next level costs more, more than he has left; Second Wind (80) too.
    await expect(
      page.getByRole('button', { name: 'Buy Stubbornness level 2 for 17 tufts' })
    ).toBeDisabled();
    await expect(page.getByTestId('survival-buy-second-wind')).toBeDisabled();
    await page.reload();
    await expect(stubbornness).toHaveAttribute('data-level', '1');
    await expect(tufts).toHaveAttribute('data-tufts', '15');
    // He goes out with 10 more Resolve.
    await startRun(page);
    await expect(page.getByRole('meter', { name: 'Resolve' })).toHaveAttribute(
      'aria-valuemax',
      '110'
    );
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
