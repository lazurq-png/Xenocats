import { type Page, expect, test } from '@playwright/test';
import { SURVIVAL_BEST_KEY } from '@/app/ui/xenocats/survival';
import { TAMED_KEY } from '@/app/ui/xenocats/taming';

// Fight a cat on /cats (no login, no database). Most tests take the fallback path:
// pointer lock is removed before the page loads, so the game runs with the fake
// cursor. The "under pointer lock" tests keep it: headless Chromium grants the lock
// and reports mouse movement, so the locked path can be played too.

async function openFight(page: Page, best?: number, { lock = false } = {}) {
  await page.addInitScript(
    ({ key, best, lock }) => {
      if (!lock) {
        Object.defineProperty(Element.prototype, 'requestPointerLock', {
          value: undefined,
          configurable: true,
        });
      }
      if (best !== undefined) window.localStorage.setItem(key, String(best));
    },
    { key: SURVIVAL_BEST_KEY, best, lock }
  );
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/cats');
  await expect(page.getByRole('heading', { name: 'Fight a cat' })).toBeVisible();
  // The fake cursor takes over on the first pointer move after hydration.
  let nudge = 0;
  await expect
    .poll(async () => {
      await page.mouse.move(640 + (nudge++ % 2), 400);
      return page.locator('html').getAttribute('class');
    })
    .toContain('xenocat-cursor-hidden');
}

async function start(page: Page) {
  await page.getByTestId('fight-start').click();
  const overlay = page.getByTestId('fight-overlay');
  await expect(overlay).toBeVisible();
  await expect(overlay).toHaveAttribute('data-mode', 'fallback');
  return overlay;
}

test('Survival: banishing every cat of a wave survives it; Esc ends the game and keeps the best score', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await openFight(page);
  await expect(page.getByTestId('fight-best')).toHaveText('Best: no waves survived yet');
  await start(page);
  await expect(page.getByTestId('fight-lives')).toHaveText('Lives: 3');
  await expect(page.getByTestId('fight-wave')).toHaveText('Wave 1');
  // No cat can be summoned during a game.
  await expect(page.getByTestId('summon-void-tabby')).toBeDisabled();

  // Click every cat that shows up until wave 1 is over.
  await expect
    .poll(
      async () => {
        const cat = page.getByTestId('fight-cat').first();
        const box = await cat.boundingBox().catch(() => null);
        if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        return page.getByTestId('fight-wave').getAttribute('data-wave');
      },
      { timeout: 40_000, intervals: [100] }
    )
    .toBe('2');
  await expect(page.getByTestId('fight-score')).toHaveText('Survived: 1');

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('fight-overlay')).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: 'Game over' })).toHaveText(
    'Game over. You survived 1 wave. Best: 1.'
  );
  await expect(page.getByTestId('fight-best')).toHaveText('Best: 1 wave');
  expect(await page.evaluate((key) => localStorage.getItem(key), SURVIVAL_BEST_KEY)).toBe('1');
  await expect(page.getByTestId('summon-void-tabby')).toBeEnabled();
  await expect(page.getByTestId('fight-start')).toHaveText('Play again');
});

test('Survival: a cat that reaches the pointer costs a life and attacks the cursor', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await openFight(page);
  await start(page);
  await page.mouse.move(640, 420);
  // The first cat arrives after 1.5 s at least 240 px away and walks at 80 px/s.
  // Two cats can land in the same moment, so this asserts a loss, not exactly one.
  await expect
    .poll(async () => Number(await page.getByTestId('fight-lives').getAttribute('data-lives')), {
      timeout: 30_000,
      intervals: [50],
    })
    .toBeLessThan(3);
  await expect(page.getByTestId('fake-cursor')).not.toHaveAttribute('data-effect', '');
});

test('Taming: a still pointer draws the cat over, holding still on it tames it into the collection', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await openFight(page);
  await expect(page.getByTestId('fight-tamed')).toHaveText('Tamed: 0 cats');
  await page.getByTestId('fight-start-taming').click();
  const overlay = page.getByTestId('fight-overlay');
  await expect(overlay).toHaveAttribute('data-kind', 'taming');
  await expect(overlay).toHaveAttribute('data-mode', 'fallback');
  // Keep still: the cat appears, gets curious after 1 s and walks over at 110 px/s.
  await page.mouse.move(400, 400);
  const cat = page.getByTestId('fight-cat');
  await expect(cat).toBeVisible();
  const typeId = await cat.getAttribute('data-cat-type');
  await expect(cat).toHaveAttribute('data-doing', 'held', { timeout: 20_000 });
  await expect(overlay.getByTestId('fight-tamed-now')).toHaveText('Tamed this game: 1', {
    timeout: 5_000,
  });

  await page.keyboard.press('Escape');
  await expect(page.getByRole('status').filter({ hasText: 'Taming over' })).toHaveText(
    'Taming over. You tamed 1 cat.'
  );
  await expect(page.getByTestId('fight-tamed')).toHaveText('Tamed: 1 cat');
  const stored = await page.evaluate((key) => localStorage.getItem(key), TAMED_KEY);
  expect(JSON.parse(stored!)).toEqual({ [typeId!]: 1 });
});

test('Taming: a pointer moving at the cat makes it dodge', async ({ page }) => {
  test.setTimeout(60_000);
  await openFight(page);
  await page.getByTestId('fight-start-taming').click();
  await page.mouse.move(100, 100);
  const cat = page.getByTestId('fight-cat');
  await expect(cat).toBeVisible();
  // A quick dodge (a teleport takes 60 ms) shows in data-doing for a frame or two,
  // too briefly for polling: record every value the page ever sets instead.
  await page.evaluate(() => {
    const seen = new Set<string>();
    (window as unknown as { doings: Set<string> }).doings = seen;
    new MutationObserver(() => {
      const doing = document.querySelector('[data-testid="fight-cat"]')?.getAttribute('data-doing');
      if (doing) seen.add(doing);
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['data-doing'] });
  });
  const dodges = ['dash', 'blink', 'sidestep', 'hop', 'circle', 'mirror', 'drop', 'axis'];
  let step = 0;
  await expect
    .poll(
      async () => {
        const box = await cat.boundingBox();
        if (box) {
          // Wiggle towards the cat, inside its notice radius.
          const x = box.x + box.width / 2 - 60 + (step++ % 2) * 20;
          await page.mouse.move(x, box.y + box.height / 2);
        }
        const seen = await page.evaluate(() =>
          Array.from((window as unknown as { doings: Set<string> }).doings)
        );
        return seen.some((doing) => dodges.includes(doing));
      },
      { timeout: 15_000, intervals: [50] }
    )
    .toBe(true);
});

test('Survival: a lower score leaves the best score alone; End game stops it too', async ({
  page,
}) => {
  await openFight(page, 7);
  await expect(page.getByTestId('fight-best')).toHaveText('Best: 7 waves');
  const overlay = await start(page);
  await overlay.getByRole('button', { name: 'End game' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Game over' })).toHaveText(
    'Game over. You survived 0 waves. Best: 7.'
  );
  expect(await page.evaluate((key) => localStorage.getItem(key), SURVIVAL_BEST_KEY)).toBe('7');
});

test('Survival: losing focus pauses the game, and the cats wait; Resume carries on', async ({
  page,
}) => {
  test.setTimeout(30_000);
  await openFight(page);
  const overlay = await start(page);
  const cat = page.getByTestId('fight-cat').first();
  await expect(cat).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(overlay).toHaveAttribute('data-phase', 'paused');
  const at = await cat.boundingBox();
  await page.waitForTimeout(600);
  expect(await cat.boundingBox()).toEqual(at);
  // The paused game is a modal dialog: Tab cycles through its own buttons only.
  const resume = overlay.getByRole('button', { name: 'Resume' });
  const end = overlay.getByRole('button', { name: 'End game' });
  await resume.focus();
  await page.keyboard.press('Tab');
  await expect(end).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(resume).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(end).toBeFocused();
  await overlay.getByRole('button', { name: 'Resume' }).click();
  await expect(overlay).toHaveAttribute('data-phase', 'playing');
  await expect.poll(() => cat.boundingBox()).not.toEqual(at);
});

/** Where the game draws its own pointer under pointer lock. */
async function lockedPointer(page: Page) {
  const transform = await page
    .getByTestId('fight-pointer')
    .evaluate((el) => (el as HTMLElement).style.transform);
  const [, x, y] = /translate3d\(([-\d.]+)px, ([-\d.]+)px/.exec(transform)!;
  return { x: Number(x), y: Number(y) };
}

test('Survival under pointer lock: the game owns the pointer, a click banishes the cat under it, and losing the lock ends it', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await openFight(page, undefined, { lock: true });
  const startButton = page.getByTestId('fight-start');
  const box = (await startButton.boundingBox())!;
  let mouse = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(mouse.x, mouse.y);
  await startButton.click();
  const overlay = page.getByTestId('fight-overlay');
  await expect(overlay).toHaveAttribute('data-mode', /locked|fallback/);
  // Some headless browsers refuse pointer lock (the game then takes the fallback
  // path, tested above); there is nothing to test here then.
  test.skip(
    (await overlay.getAttribute('data-mode')) !== 'locked',
    'This browser refused pointer lock.'
  );
  expect(await page.evaluate(() => document.pointerLockElement === document.body)).toBe(true);
  // The page's fake cursor is hidden; the game draws the pointer it owns.
  await expect(page.getByTestId('fake-cursor')).toHaveCSS('opacity', '0');
  await expect(page.getByTestId('fight-pointer')).toBeVisible();

  // The game's pointer moves by the mouse's movement.
  const before = await lockedPointer(page);
  mouse = { x: mouse.x + 60, y: mouse.y - 40 };
  await page.mouse.move(mouse.x, mouse.y, { steps: 4 });
  await expect.poll(() => lockedPointer(page)).toEqual({ x: before.x + 60, y: before.y - 40 });

  // Steer the game's pointer next to a cat and click: that cat is banished.
  // It is a real-time game: a cat can reach the pointer before the click lands (and
  // three such cats end the game), so this keeps playing, in a new game if need be,
  // until one click banishes a cat without losing a life.
  let banished = false;
  await expect
    .poll(
      async () => {
        if ((await overlay.count()) === 0) {
          const again = (await startButton.boundingBox())!;
          mouse = { x: again.x + again.width / 2, y: again.y + again.height / 2 };
          await startButton.click();
          await expect(overlay).toHaveAttribute('data-mode', 'locked');
        }
        const cat = page.getByTestId('fight-cat').first();
        const id = await cat.getAttribute('data-cat-id').catch(() => null);
        const catBox = await cat.boundingBox().catch(() => null);
        if (!id || !catBox) return false;
        const livesNow = () =>
          page
            .getByTestId('fight-lives')
            .getAttribute('data-lives', { timeout: 1000 })
            .catch(() => null);
        const lives = await livesNow();
        const centre = { x: catBox.x + catBox.width / 2, y: catBox.y + catBox.height / 2 };
        const pointer = await lockedPointer(page);
        // 34 px from the cat's centre, on the pointer's side: within a click's reach
        // (36 px), outside an attack's (24 px).
        const dx = pointer.x - centre.x;
        const dy = pointer.y - centre.y;
        const length = Math.hypot(dx, dy) || 1;
        const target = { x: centre.x + (dx / length) * 34, y: centre.y + (dy / length) * 34 };
        mouse = { x: mouse.x + target.x - pointer.x, y: mouse.y + target.y - pointer.y };
        await page.mouse.move(mouse.x, mouse.y);
        // Let the game draw the pointer there before clicking.
        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
        await page.mouse.down();
        await page.mouse.up();
        banished =
          (await page.locator(`[data-cat-id="${id}"]`).count()) === 0 &&
          lives !== null &&
          (await livesNow()) === lives;
        return banished;
      },
      { timeout: 40_000, intervals: [100] }
    )
    .toBe(true);

  // Losing the lock ends the game if the page still has focus (that is Esc) and
  // pauses it if not (another window took it). Some headless browsers never give a
  // page focus, so the test checks whichever this browser reports.
  const focused = await page.evaluate(() => document.hasFocus());
  await page.evaluate(() => document.exitPointerLock());
  expect(await page.evaluate(() => document.pointerLockElement)).toBeNull();
  if (focused) {
    await expect(page.getByTestId('fight-overlay')).toHaveCount(0);
    await expect(page.getByRole('status').filter({ hasText: 'Game over' })).toContainText(
      'Game over. You survived'
    );
  } else {
    await expect(overlay).toHaveAttribute('data-phase', 'paused');
    await expect(overlay.getByRole('button', { name: 'Resume' })).toBeVisible();
  }
});
