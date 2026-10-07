import { type Page, devices, expect, test } from '@playwright/test';
import { SURVIVAL_BEST_KEY } from '@/app/ui/xenocats/survival';
import { TAMED_KEY } from '@/app/ui/xenocats/taming';

// The fight games on their own pages, /cats/survival and /cats/taming (no login, no
// database). Most tests take the fallback path:
// pointer lock is removed before the page loads, so the game runs with the fake
// cursor. The "under pointer lock" tests keep it: headless Chromium grants the lock
// and reports mouse movement, so the locked path can be played too.

async function openFight(
  page: Page,
  best?: number,
  { lock = false, game = 'survival' }: { lock?: boolean; game?: 'survival' | 'taming' } = {}
) {
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
  await page.goto(`/cats/${game}`);
  await expect(
    page.getByRole('heading', { level: 1, name: game === 'survival' ? 'Survival' : 'Taming' })
  ).toBeVisible();
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
  const overlay = page.getByTestId('fight-area');
  await expect(overlay).toBeVisible();
  await expect(overlay).toHaveAttribute('data-mode', 'fallback');
  return overlay;
}

/** Where the game drew an element it places itself (the ranger, the crosshair, a beam). */
async function placed(page: Page, testId: string) {
  const transform = await page
    .getByTestId(testId)
    .last()
    .evaluate((el) => (el as HTMLElement).style.transform);
  const [, x, y] = /translate3d\(([-\d.]+)px, ([-\d.]+)px/.exec(transform)!;
  return { x: Number(x), y: Number(y) };
}

/**
 * Moves the mouse so the crosshair lands on `target`. The crosshair moves by how far
 * the mouse moves (a cat's attack can leave it apart from the mouse), so this moves
 * the mouse by the distance from the crosshair to the target. Returns the new mouse.
 */
async function aimAt(
  page: Page,
  mouse: { x: number; y: number },
  target: { x: number; y: number }
) {
  const crosshair = await placed(page, 'fight-crosshair');
  const next = { x: mouse.x + target.x - crosshair.x, y: mouse.y + target.y - crosshair.y };
  await page.mouse.move(next.x, next.y);
  return next;
}

/** The centre of the cat nearest the ranger, or null when there is none. */
async function nearestCat(page: Page) {
  const player = await placed(page, 'fight-player').catch(() => null);
  if (!player) return null;
  const distance = (c: { x: number; y: number }) => Math.hypot(c.x - player.x, c.y - player.y);
  let best: { x: number; y: number } | null = null;
  for (const cat of await page.getByTestId('fight-cat').all()) {
    const box = await cat.boundingBox({ timeout: 200 }).catch(() => null);
    if (!box) continue;
    const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    if (!best || distance(centre) < distance(best)) best = centre;
  }
  return best;
}

test('Survival: the self-firing beam sends every cat of a wave home; Esc ends the game and keeps the best score', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await openFight(page);
  await expect(page.getByTestId('fight-best')).toHaveText('Best: no waves survived yet');
  await start(page);
  await expect(page.getByTestId('fight-lives')).toHaveText('Lives: 3');
  await expect(page.getByTestId('fight-wave')).toHaveText('Wave 1');
  await expect(page.getByTestId('fight-player').locator('svg').first()).toBeVisible();

  // Keep the crosshair on the nearest cat until wave 1 is over: the gun fires by
  // itself. It is a real-time game: cats scramble the ranger, its aim and its gun,
  // and three that reach the ranger end the game; then a new game is started (its
  // score is 0, so the best score below still comes from the wave survived here).
  let mouse = { x: 640, y: 400 };
  await expect
    .poll(
      async () => {
        if ((await page.getByTestId('fight-area').count()) === 0) {
          await start(page);
          mouse = { x: 640, y: 400 };
        }
        const cat = await nearestCat(page);
        if (cat) mouse = await aimAt(page, mouse, cat).catch(() => mouse);
        return page
          .getByTestId('fight-wave')
          .getAttribute('data-wave', { timeout: 1000 })
          .catch(() => null);
      },
      { timeout: 60_000, intervals: [50] }
    )
    .toBe('2');
  await expect(page.getByTestId('fight-score')).toHaveText('Survived: 1');

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('fight-area')).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: 'Game over' })).toHaveText(
    'Game over. You survived 1 wave. Best: 1.'
  );
  await expect(page.getByTestId('fight-best')).toHaveText('Best: 1 wave');
  expect(await page.evaluate((key) => localStorage.getItem(key), SURVIVAL_BEST_KEY)).toBe('1');
  await expect(page.getByTestId('fight-start')).toHaveText('Play again');
});

test('Survival: the gun fires by itself, from the ranger towards the crosshair', async ({
  page,
}) => {
  await openFight(page);
  await start(page);
  const player = await placed(page, 'fight-player');
  // Aim straight up from the ranger, before any cat arrives: beams leave upwards.
  await aimAt(page, { x: 640, y: 400 }, { x: player.x, y: player.y - 200 });
  await expect
    .poll(async () => {
      const beam = await placed(page, 'fight-beam').catch(() => null);
      return beam !== null && Math.abs(beam.x - player.x) < 2 && beam.y < player.y - 40;
    })
    .toBe(true);
});

test('Survival: WASD walks the ranger, which faces the crosshair', async ({ page }) => {
  await openFight(page);
  await start(page);
  const player = page.getByTestId('fight-player');
  const before = await placed(page, 'fight-player');
  await page.keyboard.down('d');
  await expect(player).toHaveAttribute('data-walking', 'true');
  await page.waitForTimeout(400);
  await page.keyboard.up('d');
  await expect(player).toHaveAttribute('data-walking', 'false');
  const after = await placed(page, 'fight-player');
  expect(after.x).toBeGreaterThan(before.x + 50);
  expect(Math.abs(after.y - before.y)).toBeLessThan(1);

  let mouse = { x: 640, y: 400 };
  mouse = await aimAt(page, mouse, { x: after.x - 200, y: after.y });
  await expect(player).toHaveAttribute('data-facing', 'w');
  await aimAt(page, mouse, { x: after.x, y: after.y + 200 });
  await expect(player).toHaveAttribute('data-facing', 's');
});

test('Survival: a cat pounces soon after it arrives, scrambling the ranger and the crosshair', async ({
  page,
}) => {
  test.setTimeout(30_000);
  await openFight(page);
  await start(page);
  // Aim at a corner, so the beams leave the cats alone.
  await aimAt(page, { x: 640, y: 400 }, { x: 0, y: 0 });
  // The first cat arrives after 1.5 s and pounces 1 to 3 s later. Its effect may be
  // short (Knockback), so record every effect the page ever shows.
  await page.evaluate(() => {
    const seen = { player: false, crosshair: false };
    (window as unknown as { scrambled: typeof seen }).scrambled = seen;
    new MutationObserver(() => {
      const effect = (id: string) =>
        document.querySelector(`[data-testid="${id}"]`)?.getAttribute('data-effect');
      if (effect('fight-player')) seen.player = true;
      if (effect('fight-crosshair')) seen.crosshair = true;
    }).observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ['data-effect'],
    });
  });
  await expect(page.locator('[data-testid="fight-cat"][data-pounced="true"]').first()).toBeAttached(
    { timeout: 10_000 }
  );
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { scrambled: object }).scrambled))
    .toEqual({ player: true, crosshair: true });
});

test('Survival: a cat that touches the ranger costs a life', async ({ page }) => {
  test.setTimeout(60_000);
  await openFight(page);
  await start(page);
  // Aim at a corner and let the cats come.
  await aimAt(page, { x: 640, y: 400 }, { x: 0, y: 0 });
  await expect
    .poll(async () => Number(await page.getByTestId('fight-lives').getAttribute('data-lives')), {
      timeout: 40_000,
      intervals: [50],
    })
    .toBeLessThan(3);
});

/** What the Taming game shows: the ranger, the treats, what it carries, cats tamed this game. */
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
  await openFight(page, undefined, { game: 'taming' });
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
  await openFight(page, undefined, { game: 'taming' });
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
  await expect(page.getByTestId('fight-player').locator('svg').first()).toBeVisible();
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

test('Survival under pointer lock: the mouse moves the crosshair, and losing the lock ends it', async ({
  page,
}) => {
  test.setTimeout(30_000);
  await openFight(page, undefined, { lock: true });
  const startButton = page.getByTestId('fight-start');
  const box = (await startButton.boundingBox())!;
  const mouse = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(mouse.x, mouse.y);
  await startButton.click();
  const overlay = page.getByTestId('fight-area');
  await expect(overlay).toHaveAttribute('data-mode', /locked|fallback/);
  // Some headless browsers refuse pointer lock (the game then takes the fallback
  // path, tested above); there is nothing to test here then.
  test.skip(
    (await overlay.getAttribute('data-mode')) !== 'locked',
    'This browser refused pointer lock.'
  );
  expect(await page.evaluate(() => document.pointerLockElement === document.body)).toBe(true);
  // The page's fake cursor is hidden; the game draws the ranger and its crosshair.
  await expect(page.getByTestId('fake-cursor')).toHaveCSS('opacity', '0');
  await expect(page.getByTestId('fight-player').locator('svg').first()).toBeVisible();
  await expect(page.getByTestId('fight-crosshair').locator('svg')).toBeVisible();

  // The crosshair moves by the mouse's movement: under lock the browser reports only
  // how far the mouse moved (movementX/Y), and the game adds that up. The movement
  // is sent as the browser sends it, not made with page.mouse: under lock, headless
  // Chrome on Linux (CI) reports each simulated move as a jump to the pointer's
  // position on the page and straight back, which adds up to no movement at all.
  // A cat pounces on the crosshair from 2.5 s into the game, and its effect moves
  // it too (Axis lock holds one axis, Drift pushes it, ...): so the movement is
  // measured only while no effect runs on it, and measured again if one began.
  const crosshair = page.getByTestId('fight-crosshair');
  const calm = async () => ((await crosshair.getAttribute('data-effect')) ?? '') === '';
  let way = 1;
  await expect
    .poll(
      async () => {
        if (!(await calm())) return false;
        const before = await placed(page, 'fight-crosshair');
        // Back and forth, so the crosshair stays clear of the edges however often.
        const step = { x: 60 * way, y: -40 * way };
        way = -way;
        await page.evaluate(
          ({ x, y }) =>
            document.dispatchEvent(
              new MouseEvent('mousemove', { movementX: x, movementY: y, bubbles: true })
            ),
          step
        );
        // Let the game draw the move.
        await page.evaluate(
          () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
        );
        const after = await placed(page, 'fight-crosshair');
        if (!(await calm())) return false;
        // Within half a pixel: the positions are read back from decimal strings.
        return (
          Math.abs(after.x - (before.x + step.x)) < 0.5 &&
          Math.abs(after.y - (before.y + step.y)) < 0.5
        );
      },
      { timeout: 20_000, intervals: [100] }
    )
    .toBe(true);

  // Losing the lock ends the game if the page still has focus (that is Esc) and
  // pauses it if not (another window took it). Some headless browsers never give a
  // page focus, so the test checks whichever this browser reports.
  const focused = await page.evaluate(() => document.hasFocus());
  await page.evaluate(() => document.exitPointerLock());
  expect(await page.evaluate(() => document.pointerLockElement)).toBeNull();
  if (focused) {
    await expect(page.getByTestId('fight-area')).toHaveCount(0);
    await expect(page.getByRole('status').filter({ hasText: 'Game over' })).toContainText(
      'Game over. You survived'
    );
  } else {
    await expect(overlay).toHaveAttribute('data-phase', 'paused');
    await expect(overlay.getByRole('button', { name: 'Resume' })).toBeVisible();
  }
});

test('/cats links to both games, each on a page of its own', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/cats');
  await expect(page.getByRole('heading', { name: 'Fight a cat' })).toBeVisible();
  await page.getByRole('link', { name: 'Play Survival' }).click();
  await expect(page).toHaveURL(/\/cats\/survival$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Survival' })).toBeVisible();
  await expect(page.getByTestId('fight-start')).toBeVisible();
  await page.goto('/cats');
  await page.getByRole('link', { name: 'Play Taming' }).click();
  await expect(page).toHaveURL(/\/cats\/taming$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Taming' })).toBeVisible();
  await expect(page.getByTestId('fight-start-taming')).toBeVisible();
});

test('Survival: leaving the page mid-game ends the game and releases the pointer lock', async ({
  page,
}) => {
  test.setTimeout(30_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/cats');
  await page.getByRole('link', { name: 'Play Survival' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Survival' })).toBeVisible();
  let nudge = 0;
  await expect
    .poll(async () => {
      await page.mouse.move(640 + (nudge++ % 2), 400);
      return page.locator('html').getAttribute('class');
    })
    .toContain('xenocat-cursor-hidden');
  await page.getByTestId('fight-start').click();
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

  test('/cats/survival says the game needs a keyboard and mouse', async ({ page }) => {
    await page.goto('/cats/survival');
    await expect(page.getByTestId('fight-needs-keyboard')).toHaveText(
      'This game needs a keyboard and mouse, for now. Come back on a computer to play it.'
    );
    await expect(page.getByTestId('fight-start')).toHaveCount(0);
  });

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
