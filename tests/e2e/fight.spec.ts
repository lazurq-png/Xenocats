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
  // No cat can be summoned during a game.
  await expect(page.getByTestId('summon-void-tabby')).toBeDisabled();

  // Keep the crosshair on the nearest cat until wave 1 is over: the gun fires by
  // itself. It is a real-time game: cats scramble the ranger, its aim and its gun,
  // and three that reach the ranger end the game; then a new game is started (its
  // score is 0, so the best score below still comes from the wave survived here).
  let mouse = { x: 640, y: 400 };
  await expect
    .poll(
      async () => {
        if ((await page.getByTestId('fight-overlay').count()) === 0) {
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
  await expect(page.getByTestId('fight-overlay')).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: 'Game over' })).toHaveText(
    'Game over. You survived 1 wave. Best: 1.'
  );
  await expect(page.getByTestId('fight-best')).toHaveText('Best: 1 wave');
  expect(await page.evaluate((key) => localStorage.getItem(key), SURVIVAL_BEST_KEY)).toBe('1');
  await expect(page.getByTestId('summon-void-tabby')).toBeEnabled();
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
  await expect(page.getByTestId('fight-player').locator('svg').first()).toBeVisible();
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
  const overlay = page.getByTestId('fight-overlay');
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
    await expect(page.getByTestId('fight-overlay')).toHaveCount(0);
    await expect(page.getByRole('status').filter({ hasText: 'Game over' })).toContainText(
      'Game over. You survived'
    );
  } else {
    await expect(overlay).toHaveAttribute('data-phase', 'paused');
    await expect(overlay.getByRole('button', { name: 'Resume' })).toBeVisible();
  }
});
