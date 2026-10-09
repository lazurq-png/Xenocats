import { type Locator, type Page, devices, expect, test } from './fixtures';
import { ARENA_CONFIG } from '@/app/ui/xenocats/arena';
import { SURVIVAL_BEST_KEY } from '@/app/ui/xenocats/arena-storage';
import { SOUND_KEY } from '@/app/ui/xenocats/sounds';

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

/**
 * Takes a choice from the level-up on screen (a weapon if one is offered) with
 * `press`, and says what was taken: its kind, id and level.
 */
async function takeChoice(page: Page, press: (index: number) => Promise<void>) {
  const buttons = levelUp(page).getByRole('button');
  const kinds = await buttons.evaluateAll((all) => all.map((b) => b.getAttribute('data-kind')));
  const pick = Math.max(kinds.indexOf('weapon'), 0);
  const taken = {
    kind: kinds[pick],
    id: (await buttons.nth(pick).getAttribute('data-choice')) ?? '',
    level: Number(await buttons.nth(pick).getAttribute('data-level')),
  };
  await press(pick);
  return taken;
}

/** The pause menu lists what was taken at its level (or higher: a later choice may raise it). */
async function expectInSummary(
  summary: Locator,
  taken: { kind: string | null; id: string; level: number }
) {
  await expect(summary).toBeVisible();
  const weapons = summary.locator('li[data-weapon]');
  const passives = summary.locator('li[data-passive]');
  // The slot counts agree with what is listed, out of six each.
  await expect(summary.getByTestId('survival-pause-weapon-slots')).toHaveText(
    `Weapons ${await weapons.count()} of 6`
  );
  await expect(summary.getByTestId('survival-pause-passive-slots')).toHaveText(
    `Passives ${await passives.count()} of 6`
  );
  if (taken.kind === 'restore') return;
  const row = summary.locator(
    taken.kind === 'weapon' ? `li[data-weapon="${taken.id}"]` : `li[data-passive="${taken.id}"]`
  );
  await expect(row).toHaveCount(1);
  const level = Number(await row.getAttribute('data-level'));
  expect(level).toBeGreaterThanOrEqual(taken.level);
  await expect(row).toContainText(`${level} / `);
}

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
    .poll(
      async () => {
        if ((await area(page).count()) === 0) {
          const button = page.getByTestId('survival-start');
          if (tap) await button.tap();
          else await button.click();
        }
        return area(page).count();
      },
      // A busy `next dev` may still be hydrating the page (as the other specs allow).
      { timeout: 15_000 }
    )
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

  test('?fps=1 shows the frame time and cat count, and without it nothing is shown', async ({
    page,
  }) => {
    await openArena(page);
    await startRun(page);
    await expect(page.getByTestId('survival-fps')).toHaveCount(0);

    await openArena(page, '?seed=7&fps=1');
    await startRun(page);
    const fps = page.getByTestId('survival-fps');
    await expect(fps).toBeVisible();
    await expect(fps).toHaveText(/^\d+(\.\d+)? ms · \d+ cats$/);
  });

  test('?crowd= brings a crowd at once, with the weapons to meet it and no level-up in the way', async ({
    page,
  }) => {
    await openArena(page, '?seed=7&crowd=300');
    await startRun(page);
    await expect.poll(() => num(page, 'data-cats'), { timeout: 30_000 }).toBeGreaterThan(150);
    await expect(area(page)).toHaveAttribute('data-weapons', /infinite-laser:8/);
    await expect(area(page)).toHaveAttribute('data-screen', 'playing');
  });

  test('the run length is chosen in the lobby and remembered, and the HUD, the pause menu and the results show it', async ({
    page,
  }) => {
    await openArena(page, '?seed=7&speed=3');
    await expect(page.getByTestId('survival-length-5')).toBeChecked();
    await page.getByTestId('survival-length-10').check();
    await expect(page.getByTestId('survival-best')).toHaveText(
      'Longest survived (10 minutes): none yet'
    );
    // Remembered across a reload.
    await page.reload();
    await expect(page.getByTestId('survival-length-10')).toBeChecked();

    await startRun(page);
    await expect(page.getByTestId('survival-time')).toContainText('/ 10:00');
    const paused = await pauseRun(page);
    await expect(paused.getByTestId('survival-pause-length')).toHaveText('10:00');
    await paused.getByRole('button', { name: 'Give up' }).click();
    await expect(page.getByTestId('survival-results')).toHaveAttribute('data-outcome', 'gave-up');
    await expect(page.getByTestId('survival-result-length')).toHaveText('10:00');
    // The five-minute best is a different one.
    await page.getByTestId('survival-length-5').check();
    await expect(page.getByTestId('survival-best')).toHaveText(
      'Longest survived (5 minutes): none yet'
    );
  });

  test('an elite near the Keeper winds up an attack the HUD data shows', async ({ page }) => {
    test.setTimeout(90_000);
    await openArena(page, '?seed=7&speed=8&elite=1');
    await startRun(page);
    // The run is over in under a minute: watch from inside the page, every frame,
    // rather than poll from here.
    await page.waitForFunction(
      () =>
        Number(
          document
            .querySelector('[data-testid="survival-area"]')
            ?.getAttribute('data-windups-begun')
        ) > 0,
      undefined,
      { timeout: 60_000 }
    );
  });

  test('a new household weapon, taken at a level-up of a seeded run, is in the pause menu', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const household = ['feather-wand', 'squeaky-toy', 'cardboard-box', 'hair-dryer', 'bath-tub'];
    await openArena(page, '?seed=7&speed=4');
    await startRun(page);
    let taken = '';
    const walk = ['d', 's', 'a', 'w'];
    for (let turn = 0; turn < 400 && !taken; turn++) {
      if ((await area(page).count()) === 0) break;
      const dialog = levelUp(page);
      if ((await dialog.count()) > 0) {
        const ids = await dialog
          .getByRole('button')
          .evaluateAll((all) => all.map((b) => b.getAttribute('data-choice') ?? ''));
        const at = ids.findIndex((id) => household.includes(id));
        if (at >= 0) {
          taken = ids[at];
          await page.keyboard.press(String(at + 1));
        } else {
          await page.keyboard.press('1');
        }
      }
      // He walks a square, to last as long as he can.
      const key = walk[turn % 4];
      await page.keyboard.down(key);
      await page.waitForTimeout(350);
      await page.keyboard.up(key);
    }
    expect(household).toContain(taken);
    await expect(area(page)).toHaveAttribute('data-weapons', new RegExp(taken));
    const paused = await pauseRun(page);
    await expect(paused.locator(`li[data-weapon="${taken}"]`)).toBeVisible();
  });

  test('two evolved weapons held at a chest fuse into one, named in the pause menu', async ({
    page,
  }) => {
    await openArena(page, '?seed=7&fusion=1');
    await startRun(page);
    await expect(area(page)).toHaveAttribute('data-weapons', 'thunderstorm:8');
    const paused = await pauseRun(page);
    await expect(paused.locator('li[data-weapon="thunderstorm"]')).toBeVisible();
    await expect(paused.locator('li[data-weapon="infinite-laser"]')).toHaveCount(0);
    await expect(paused.locator('li[data-weapon="monsoon"]')).toHaveCount(0);
    // One slot where there were two.
    await expect(paused.getByTestId('survival-pause-weapon-slots')).toHaveText('Weapons 1 of 6');
  });

  test('the pause menu marks a fused weapon and a new one with different tiers', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await openArena(page, '?seed=7&speed=4&fusion=1');
    await startRun(page);
    // Take a weapon at the first level-up that offers one (a new weapon is tier 1).
    let taken = '';
    const walk = ['d', 's', 'a', 'w'];
    for (let turn = 0; turn < 400 && !taken; turn++) {
      if ((await area(page).count()) === 0) break;
      const dialog = levelUp(page);
      if ((await dialog.count()) > 0) {
        const kinds = await dialog
          .getByRole('button')
          .evaluateAll((all) => all.map((b) => b.getAttribute('data-kind')));
        const at = kinds.indexOf('weapon');
        if (at >= 0) {
          // Its card carries the tier too: a level-1 weapon is tier 1, and its name is written.
          const card = dialog.getByRole('button').nth(at);
          await expect(card).toHaveAttribute('data-tier', '1');
          await expect(card.getByTestId('choice-tier')).toHaveText('Basic');
          taken = (await card.getAttribute('data-choice')) ?? '';
          await page.keyboard.press(String(at + 1));
        } else await page.keyboard.press('1');
      }
      const key = walk[turn % 4];
      await page.keyboard.down(key);
      await page.waitForTimeout(350);
      await page.keyboard.up(key);
    }
    expect(taken).not.toBe('');
    const paused = await pauseRun(page);
    const fused = paused.locator('li[data-weapon="thunderstorm"]');
    const fresh = paused.locator(`li[data-weapon="${taken}"]`);
    await expect(fused).toHaveAttribute('data-tier', '7');
    await expect(fresh).toHaveAttribute('data-tier', '1');
    await expect(fused.getByTestId('survival-pause-tier')).toHaveText('(Fused)');
    await expect(fresh.getByTestId('survival-pause-tier')).toHaveText('(Basic)');
  });

  test('the Keeper faces the crosshair in all eight directions; automatic, he faces a cat or the way he walks', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1280, height: 800 });
    await openArena(page, '?seed=7');
    await page.getByTestId('survival-lobby-aim-crosshair').check();
    await startRun(page);
    // The Keeper stands in the middle of the screen: the mouse goes round him.
    const centre = { x: 640, y: 400 };
    const eight = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
    for (let k = 0; k < 8; k++) {
      const angle = (k * Math.PI) / 4;
      await page.mouse.move(centre.x + Math.cos(angle) * 250, centre.y + Math.sin(angle) * 250);
      await expect(area(page)).toHaveAttribute('data-hero-facing', eight[k]);
    }
    // Put the crosshair away. He stands still, so the way he walked last is east (he has
    // not walked); facing anything else means he turned to a cat.
    const paused = await pauseRun(page);
    await paused.getByTestId('survival-pause-aim-auto').check();
    await paused.getByRole('button', { name: 'Resume' }).click();
    await expect(area(page)).toHaveAttribute('data-aim', 'auto');
    await expect
      .poll(() => area(page).getAttribute('data-hero-facing'), { timeout: 30_000 })
      .not.toBe('E');
  });

  test('Graphics: light is chosen in the pause menu, holds on resume and in the lobby, and draws at one pixel to a pixel', async ({
    browser,
  }) => {
    test.setTimeout(60_000);
    const context = await browser.newContext({
      viewport: { width: 1000, height: 700 },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    // No run has switched itself to light before, and none will here.
    await page.addInitScript(() => localStorage.setItem('xenocats:survival:v1:graphics-auto', '1'));
    await openArena(page, '?seed=7');
    await expect(page.getByTestId('survival-lobby-graphics-full')).toBeChecked();
    await startRun(page);
    await expect(area(page)).toHaveAttribute('data-graphics', 'full');
    const canvasWidth = () =>
      page.locator('canvas').evaluate((c) => (c as HTMLCanvasElement).width);
    // Full: the screen's own pixel ratio (2).
    await expect.poll(canvasWidth).toBe(2000);

    const paused = await pauseRun(page);
    await expect(paused.getByTestId('survival-pause-graphics-full')).toBeChecked();
    await paused.getByTestId('survival-pause-graphics-light').check();
    await paused.getByRole('button', { name: 'Resume' }).click();
    await expect(area(page)).toHaveAttribute('data-graphics', 'light');
    // Light: one pixel to a pixel.
    await expect.poll(canvasWidth).toBe(1000);

    // It holds: paused again it is still light; in the lobby, the same.
    const again = await pauseRun(page);
    await expect(again.getByTestId('survival-pause-graphics-light')).toBeChecked();
    await again.getByRole('button', { name: 'Give up' }).click();
    await expect(page.getByTestId('survival-lobby-graphics-light')).toBeChecked();
    await page.reload();
    await expect(page.getByTestId('survival-lobby-graphics-light')).toBeChecked();
    await context.close();
  });

  test('a screen too slow for the frame floor is switched to light graphics, once, with a notice', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await openArena(page, '?seed=7');
    await expect(area(page)).toHaveCount(0);
    // Six times slower than this machine: well under 40 frames a second.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
    await startRun(page);
    await expect(area(page)).toHaveAttribute('data-graphics', 'light', { timeout: 30_000 });
    await expect(page.getByTestId('survival-notice')).toContainText('struggling');
    expect(
      await page.evaluate(() => localStorage.getItem('xenocats:survival:v1:graphics-auto'))
    ).toBe('1');
    expect(await page.evaluate(() => localStorage.getItem('xenocats:survival:v1:graphics'))).toBe(
      'light'
    );
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    // The player changes it back: it does not switch again.
    const paused = await pauseRun(page);
    await paused.getByTestId('survival-pause-graphics-full').check();
    await paused.getByRole('button', { name: 'Resume' }).click();
    await expect(area(page)).toHaveAttribute('data-graphics', 'full');
  });

  test('on a computer the camera is unzoomed', async ({ page }) => {
    await openArena(page);
    await startRun(page);
    await expect.poll(() => num(page, 'data-zoom')).toBe(1);
  });

  test('the pause menu shows the run so far: the choice taken at its level, free slots, the run', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await openArena(page, '?seed=7&speed=6');
    await startRun(page);
    // Walk until a level-up, and take a weapon if one is offered.
    await page.keyboard.down('d');
    const dialog = levelUp(page);
    await expect(dialog).toBeVisible({ timeout: 40_000 });
    await page.keyboard.up('d');
    const taken = await takeChoice(page, async (i) => page.keyboard.press(String(i + 1)));
    const paused = await pauseRun(page);
    await expectInSummary(paused.getByTestId('survival-pause-summary'), taken);
    await expect(paused.getByTestId('survival-pause-level')).toContainText(/^[2-9]/);
    await expect(paused.getByTestId('survival-pause-time')).toHaveText(/^\d+:\d\d$/);
    // Resume is still what the menu puts the focus on.
    await expect(paused.getByRole('button', { name: 'Resume' })).toBeFocused();
  });

  test('aiming with a crosshair: chosen in the lobby, drawn where the mouse is, put away in the pause menu', async ({
    page,
  }) => {
    await openArena(page);
    await expect(page.getByTestId('survival-lobby-aim-auto')).toBeChecked();
    await page.getByTestId('survival-lobby-aim-crosshair').check();
    await startRun(page);
    await expect(area(page)).toHaveAttribute('data-aim', 'crosshair');
    const crosshairAt = async (x: number, y: number) => {
      await page.mouse.move(x, y);
      await expect
        .poll(async () => {
          await playOn(page);
          return area(page).getAttribute('data-crosshair');
        })
        .toBe(`${x},${y}`);
    };
    await crosshairAt(300, 200);
    await crosshairAt(900, 600);
    // The pause menu shows the choice; switched back to automatic, the crosshair goes.
    const paused = await pauseRun(page);
    await expect(paused.getByTestId('survival-pause-aim-crosshair')).toBeChecked();
    await paused.getByTestId('survival-pause-aim-auto').check();
    await paused.getByRole('button', { name: 'Resume' }).click();
    await expect(area(page)).toHaveAttribute('data-aim', 'auto');
    await expect
      .poll(async () => {
        await playOn(page);
        return area(page).getAttribute('data-crosshair');
      })
      .toBe('');
    // Kept for the next visit.
    await page.reload();
    await expect(page.getByTestId('survival-lobby-aim-auto')).toBeChecked();
  });

  test('sound is switched in the pause menu: it holds after Resume, and the lobby and the site share it', async ({
    page,
  }) => {
    await openArena(page);
    const lobby = page.getByTestId('survival-lobby-sound');
    await expect(lobby).toBeChecked();
    await startRun(page);
    const paused = await pauseRun(page);
    const sound = paused.getByRole('checkbox', { name: 'Sound' });
    await expect(sound).toBeChecked();
    // Resume is still what the menu puts the focus on.
    await expect(paused.getByRole('button', { name: 'Resume' })).toBeFocused();
    // From the keyboard, like any checkbox.
    await sound.focus();
    await page.keyboard.press(' ');
    await expect(sound).not.toBeChecked();
    expect(await page.evaluate((key) => localStorage.getItem(key), SOUND_KEY)).toBe('off');
    await paused.getByRole('button', { name: 'Resume' }).click();
    await expect(area(page)).toHaveAttribute('data-screen', 'playing');
    const again = await pauseRun(page);
    await expect(again.getByRole('checkbox', { name: 'Sound' })).not.toBeChecked();
    await again.getByRole('button', { name: 'Give up' }).click();
    // The lobby shows the same setting, and switches it back.
    await expect(lobby).not.toBeChecked();
    await lobby.check();
    expect(await page.evaluate((key) => localStorage.getItem(key), SOUND_KEY)).toBe('on');
    await page.reload();
    await expect(page.getByTestId('survival-lobby-sound')).toBeChecked();
  });

  test('a run: time passes, the Laser Pointer sends cats home, Esc pauses, giving up shows the results and keeps the best time', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await openArena(page, '?seed=7&speed=3');
    await expect(page.getByTestId('survival-best')).toHaveText(
      'Longest survived (5 minutes): none yet'
    );
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
    await expect(page.getByTestId('survival-best')).not.toHaveText(
      'Longest survived (5 minutes): none yet'
    );
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
    // Each card that improves something says exactly what (arsenal.ts, levelChanges):
    // a passive, or a weapon held already; a new weapon has only its own line.
    let named = 0;
    for (const button of await buttons.all()) {
      const kind = await button.getAttribute('data-kind');
      const level = Number(await button.getAttribute('data-level'));
      const change = button.getByTestId('choice-change');
      if (kind === 'passive' || (kind === 'weapon' && level > 1)) {
        await expect(change).toHaveText(
          /^(\+\d|Fires \d|Weapons ready \d|Lasts \d|Passes|Holds|What his weapons|Untouchable|Elite effects)/
        );
        named++;
      } else {
        await expect(change).toHaveCount(0);
      }
    }
    // This seed's first offer holds at least one such card, so the check above ran.
    expect(named).toBeGreaterThan(0);
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
          // The HUD is only updated while playing: a further level-up waiting
          // would hold it back, so take it (it can only raise the level).
          await playOn(page);
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
    // It wears a xenocat's face, and says whose.
    await expect(page.getByTestId('survival-notice')).toHaveText(
      /^A giant .+ has come for the Keeper\.$/
    );
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
    // Eleven evolutions, four fusions and the secret cat: one found, the rest unknown.
    await expect(codex.getByRole('listitem').filter({ hasText: '???' })).toHaveCount(15);
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

  test('on a phone the camera zooms out, to show as much of the arena as the rule says', async ({
    page,
  }) => {
    await openArena(page);
    await startRun(page, true);
    const size = page.viewportSize()!;
    const narrower = Math.min(size.width, size.height);
    const expected =
      Math.round(
        Math.min(Math.max(ARENA_CONFIG.view.minView / narrower, 1), ARENA_CONFIG.view.maxZoom) * 100
      ) / 100;
    expect(expected).toBeGreaterThan(1);
    await expect.poll(() => num(page, 'data-zoom')).toBe(expected);
  });

  test('the pause menu shows the run so far on a phone too, after a level-up', async ({ page }) => {
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
    await expect(levelUp(page)).toBeVisible({ timeout: 40_000 });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const buttons = levelUp(page).getByRole('button');
    const taken = await takeChoice(page, (i) => buttons.nth(i).tap());
    // Another level may follow at once: take choices until the run is playing.
    await expect
      .poll(async () => {
        await playOn(page, true);
        return levelUp(page).count();
      })
      .toBe(0);
    await area(page).getByRole('button', { name: 'Pause' }).tap();
    const paused = page.getByRole('dialog', { name: 'Paused' });
    await expectInSummary(paused.getByTestId('survival-pause-summary'), taken);
    // The menu fits the phone: it scrolls inside itself, and Resume is in it.
    const resume = paused.getByRole('button', { name: 'Resume' });
    await resume.scrollIntoViewIfNeeded();
    await expect(resume).toBeInViewport();
  });

  test('a touch screen is not offered a crosshair: its weapons aim themselves', async ({
    page,
  }) => {
    await openArena(page);
    await expect(page.getByTestId('survival-lobby-sound')).toBeVisible();
    await expect(page.getByTestId('survival-lobby-aim-crosshair')).toHaveCount(0);
    await startRun(page, true);
    await expect(area(page)).toHaveAttribute('data-aim', 'auto');
    await playOn(page, true);
    await area(page).getByRole('button', { name: 'Pause' }).tap();
    const paused = page.getByRole('dialog', { name: 'Paused' });
    await expect(paused.getByTestId('survival-pause-sound')).toBeVisible();
    await expect(paused.getByTestId('survival-pause-aim-crosshair')).toHaveCount(0);
  });

  test('sound is switched in the pause menu with a tap; it holds, and the lobby shows it', async ({
    page,
  }) => {
    await openArena(page);
    await expect(page.getByTestId('survival-lobby-sound')).toBeChecked();
    await startRun(page, true);
    await playOn(page, true);
    await area(page).getByRole('button', { name: 'Pause' }).tap();
    const paused = page.getByRole('dialog', { name: 'Paused' });
    const sound = paused.getByRole('checkbox', { name: 'Sound' });
    await sound.tap();
    await expect(sound).not.toBeChecked();
    await paused.getByRole('button', { name: 'Resume' }).tap();
    await expect(area(page)).toHaveAttribute('data-screen', 'playing');
    await playOn(page, true);
    await area(page).getByRole('button', { name: 'Pause' }).tap();
    await expect(paused.getByRole('checkbox', { name: 'Sound' })).not.toBeChecked();
    await paused.getByRole('button', { name: 'Give up' }).tap();
    await expect(page.getByTestId('survival-lobby-sound')).not.toBeChecked();
  });

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
