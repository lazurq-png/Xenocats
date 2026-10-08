import { type Page, devices, expect, test } from '@playwright/test';
import { TAMED_KEY } from '@/app/ui/xenocats/taming';

// Taming on its own page, /cats/taming, and the links to both games from /cats (no
// login, no database). Survival, the arena, has its own spec (survival.spec.ts).
// Most tests take the fallback path: pointer lock is removed before the page loads.
// The leave-the-page test keeps it: headless Chromium grants the lock.

async function openFight(page: Page, { lock = false }: { lock?: boolean } = {}) {
  await page.addInitScript(
    ({ lock }) => {
      if (!lock) {
        Object.defineProperty(Element.prototype, 'requestPointerLock', {
          value: undefined,
          configurable: true,
        });
      }
    },
    { lock }
  );
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/cats/taming');
  await expect(page.getByRole('heading', { level: 1, name: 'Taming' })).toBeVisible();
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
  await page.getByTestId('fight-start-taming').click();
  const area = page.getByTestId('fight-area');
  await expect(area).toBeVisible();
  await expect(area).toHaveAttribute('data-mode', 'fallback');
  return area;
}

const tamingState = (page: Page) =>
  page.evaluate(() => {
    const ranger = document.querySelector<HTMLElement>('[data-testid="fight-player"]');
    const treats = Array.from(
      document.querySelectorAll<HTMLElement>('[data-testid="fight-treat"]'),
      (el) => ({ x: Number(el.dataset.x), y: Number(el.dataset.y) })
    );
    const carrying =
      document.querySelector<HTMLElement>('[data-testid="fight-carrying"]')?.dataset.carrying ?? '';
    const tamed = document.querySelector('[data-testid="fight-tamed-now"]')?.textContent ?? '';
    return {
      ranger:
        ranger?.dataset.x !== undefined
          ? { x: Number(ranger.dataset.x), y: Number(ranger.dataset.y) }
          : null,
      treats,
      carrying,
      tamed,
    };
  });

/**
 * Walks the ranger to the nearest treat (re-aiming as it goes: a cat's attack can
 * push it about or turn its controls round), then stands still with the treat until
 * the cat comes and is tamed. `steer` holds the ranger's way: -1, 0 or 1 on each axis.
 */
async function fetchTreatAndTame(
  page: Page,
  steer: (way: { x: number; y: number }) => Promise<void>
) {
  await expect
    .poll(
      async () => {
        const state = await tamingState(page);
        if (state.tamed.endsWith(': 1')) {
          await steer({ x: 0, y: 0 });
          return 'tamed';
        }
        if (state.carrying || !state.ranger || state.treats.length === 0) {
          await steer({ x: 0, y: 0 });
          return state.carrying ? 'carrying' : 'waiting';
        }
        const { ranger } = state;
        const near = state.treats.reduce((a, b) =>
          Math.hypot(a.x - ranger.x, a.y - ranger.y) <= Math.hypot(b.x - ranger.x, b.y - ranger.y)
            ? a
            : b
        );
        const axis = (d: number) => (Math.abs(d) < 12 ? 0 : Math.sign(d));
        await steer({ x: axis(near.x - ranger.x), y: axis(near.y - ranger.y) });
        return 'walking';
      },
      { timeout: 50_000, intervals: [60] }
    )
    .toBe('tamed');
}

test('Taming: walk to a treat, carry it to the cat, and the cat is tamed into the collection', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await openFight(page);
  await expect(page.getByTestId('fight-tamed')).toHaveText('Tamed: 0 cats');
  await page.getByTestId('fight-start-taming').click();
  const area = page.getByTestId('fight-area');
  await expect(area).toHaveAttribute('data-mode', 'fallback');
  // Empty-handed, and unarmed.
  await expect(page.getByTestId('fight-carrying')).toHaveText('Carrying: nothing');
  await expect(page.getByTestId('fight-player')).toBeAttached();
  await expect(page.getByTestId('fight-treat').first()).toBeAttached({ timeout: 5000 });
  // No movement pad with a keyboard and mouse.
  await expect(page.getByTestId('movement-pad')).toHaveCount(0);

  // WASD, held and let go as the ranger needs.
  const held = new Set<string>();
  const hold = async (key: string, on: boolean) => {
    if (on && !held.has(key)) {
      held.add(key);
      await page.keyboard.down(key);
    } else if (!on && held.has(key)) {
      held.delete(key);
      await page.keyboard.up(key);
    }
  };
  await fetchTreatAndTame(page, async ({ x, y }) => {
    await hold('d', x > 0);
    await hold('a', x < 0);
    await hold('s', y > 0);
    await hold('w', y < 0);
  });

  await expect(page.getByRole('status').filter({ hasText: 'You tamed' })).toBeVisible();
  await area.getByRole('button', { name: 'End game' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Taming over' })).toHaveText(
    'Taming over. You tamed 1 cat.'
  );
  // Into the collection, kept after a reload.
  await expect(page.getByTestId('fight-tamed')).toHaveText('Tamed: 1 cat');
  const stored = await page.evaluate((key) => localStorage.getItem(key), TAMED_KEY);
  expect(Object.values(JSON.parse(stored!) as Record<string, number>)).toEqual([1]);
});

test('Taming: without a treat the cat keeps away from the ranger, and attacks it', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await openFight(page);
  await page.getByTestId('fight-start-taming').click();
  await expect(page.getByTestId('fight-cat')).toBeVisible({ timeout: 5000 });
  // Read at one instant: the ranger, the cat and what it is doing, the effect on the
  // ranger, and whether a treat is in hand.
  const look = () =>
    page.evaluate(() => {
      const ranger = document.querySelector<HTMLElement>('[data-testid="fight-player"]');
      const cat = document.querySelector<HTMLElement>('[data-testid="fight-cat"]');
      const box = cat?.getBoundingClientRect();
      return {
        ranger: ranger?.dataset.x
          ? { x: Number(ranger.dataset.x), y: Number(ranger.dataset.y) }
          : null,
        cat: box ? { x: box.left + box.width / 2, y: box.top + box.height / 2 } : null,
        doing: cat?.dataset.doing ?? '',
        effect: ranger?.dataset.effect ?? '',
        carrying:
          document.querySelector<HTMLElement>('[data-testid="fight-carrying"]')?.dataset.carrying ??
          '',
      };
    });
  const held = new Set<string>();
  const hold = async (key: string, on: boolean) => {
    if (on && !held.has(key)) {
      held.add(key);
      await page.keyboard.down(key);
    } else if (!on && held.has(key)) {
      held.delete(key);
      await page.keyboard.up(key);
    }
  };
  // Walk straight at the cat, empty-handed, until it has dodged and attacked. A treat
  // picked up on the way changes the game (the cat comes for it): start a new one.
  let dodged = false;
  let attacked = false;
  for (let i = 0; i < 300 && !(dodged && attacked); i++) {
    const state = await look();
    if (state.carrying) {
      for (const key of [...held]) await hold(key, false);
      await page.getByTestId('fight-area').getByRole('button', { name: 'End game' }).click();
      await page.getByTestId('fight-start-taming').click();
      await expect(page.getByTestId('fight-carrying')).toHaveText('Carrying: nothing');
      continue;
    }
    // Empty-handed, it never comes to the ranger.
    expect(state.doing).not.toBe('coming');
    if (!['', 'wandering', 'coming'].includes(state.doing)) dodged = true;
    if (state.effect !== '') attacked = true;
    if (state.ranger && state.cat) {
      const { ranger, cat } = state;
      await hold('d', cat.x > ranger.x + 12);
      await hold('a', cat.x < ranger.x - 12);
      await hold('s', cat.y > ranger.y + 12);
      await hold('w', cat.y < ranger.y - 12);
    }
    await page.waitForTimeout(100);
  }
  for (const key of [...held]) await hold(key, false);
  // It dodged, in its own way, and its attack landed on the ranger as in Survival.
  expect(dodged).toBe(true);
  expect(attacked).toBe(true);
});

test('Taming: losing focus pauses the game, and the cat waits; Resume carries on', async ({
  page,
}) => {
  test.setTimeout(30_000);
  await openFight(page);
  const overlay = await start(page);
  const cat = page.getByTestId('fight-cat').first();
  await expect(cat).toBeVisible({ timeout: 5000 });
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(overlay).toHaveAttribute('data-phase', 'paused');
  const at = await cat.boundingBox();
  await page.waitForTimeout(600);
  expect(await cat.boundingBox()).toEqual(at);
  // The game is the page, not a dialog. What the play area covers (the header's
  // links, Start) is inert while it runs: Tab never lands on anything hidden.
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(overlay.getByRole('button', { name: 'End game' })).toBeVisible();
  const focusIsVisible = () =>
    page.evaluate(() => {
      const active = document.activeElement;
      const area = document.querySelector('[data-testid="fight-area"]');
      return active === document.body || active === null || !!area?.contains(active);
    });
  await overlay.getByRole('button', { name: 'Resume' }).focus();
  for (const key of ['Tab', 'Tab', 'Shift+Tab', 'Shift+Tab', 'Shift+Tab']) {
    await page.keyboard.press(key);
    expect(await focusIsVisible(), key).toBe(true);
  }
  await overlay.getByRole('button', { name: 'Resume' }).click();
  await expect(overlay).toHaveAttribute('data-phase', 'playing');
  await expect.poll(() => cat.boundingBox()).not.toEqual(at);
});

test('/cats links to both games, each on a page of its own', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/cats');
  await expect(page.getByRole('heading', { name: 'Fight a cat' })).toBeVisible();
  await page.getByRole('link', { name: 'Play Survival' }).click();
  await expect(page).toHaveURL(/\/cats\/survival$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Survival' })).toBeVisible();
  await expect(page.getByTestId('survival-start')).toBeVisible();
  await page.goto('/cats');
  await page.getByRole('link', { name: 'Play Taming' }).click();
  await expect(page).toHaveURL(/\/cats\/taming$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Taming' })).toBeVisible();
  await expect(page.getByTestId('fight-start-taming')).toBeVisible();
});

test('Taming: leaving the page mid-game ends the game and releases the pointer lock', async ({
  page,
}) => {
  test.setTimeout(30_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/cats');
  await page.getByRole('link', { name: 'Play Taming' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Taming' })).toBeVisible();
  let nudge = 0;
  await expect
    .poll(async () => {
      await page.mouse.move(640 + (nudge++ % 2), 400);
      return page.locator('html').getAttribute('class');
    })
    .toContain('xenocat-cursor-hidden');
  await page.getByTestId('fight-start-taming').click();
  const area = page.getByTestId('fight-area');
  // Some headless browsers refuse pointer lock; then the game runs on the fallback.
  await expect(area).toHaveAttribute('data-mode', /locked|fallback/);
  const locked = (await area.getAttribute('data-mode')) === 'locked';
  // Back to /cats inside the app: the game's page goes away.
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Fight a cat' })).toBeVisible();
  await expect(area).toHaveCount(0);
  if (locked) expect(await page.evaluate(() => document.pointerLockElement)).toBeNull();
  // Nothing is left inert on the page it came back to.
  await expect(page.locator('[inert]')).toHaveCount(0);
});

test.describe('on a touch screen', () => {
  // A phone's screen and touch input (its browser type cannot change inside a group).
  const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices['Pixel 7'];
  test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });

  test('/cats/taming is played with the movement pad: a treat carried to the cat tames it', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.goto('/cats/taming');
    await expect(page.getByTestId('fight-needs-keyboard')).toHaveCount(0);
    // A tap before hydration is lost: tap until the game starts.
    const area = page.getByTestId('fight-area');
    await expect
      .poll(async () => {
        if ((await area.count()) === 0) await page.getByTestId('fight-start-taming').tap();
        return area.count();
      })
      .toBe(1);
    // Never locked on a touch screen.
    await expect(area).toHaveAttribute('data-mode', 'fallback');
    const pad = page.getByTestId('movement-pad');
    await expect(pad).toBeVisible();
    await expect(pad).toHaveAttribute('aria-hidden', 'true');
    const box = (await pad.boundingBox())!;
    const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    // Real touches on the pad: a thumb put down, slid, and lifted.
    const cdp = await page.context().newCDPSession(page);
    let down = false;
    await fetchTreatAndTame(page, async ({ x, y }) => {
      if (x === 0 && y === 0) {
        if (down) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        down = false;
        return;
      }
      const point = { x: centre.x + x * 50, y: centre.y + y * 50 };
      await cdp.send('Input.dispatchTouchEvent', {
        type: down ? 'touchMove' : 'touchStart',
        touchPoints: [point],
      });
      down = true;
    });
    await area.getByRole('button', { name: 'End game' }).tap();
    await expect(page.getByTestId('fight-tamed')).toHaveText('Tamed: 1 cat');
  });
});
