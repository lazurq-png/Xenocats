import { type Page, devices, expect, test } from '@playwright/test';
import { CAT_CONFIG } from '@/app/ui/xenocats/config';
import { vanish } from '@/app/ui/xenocats/effects';

// Petting and poking a sleeping cat on /cats (no login, no database). Web Audio is
// replaced by a stand-in that counts the tones it is asked to play. The page's
// timers run on a fake clock, which keeps real time until a test moves it on
// (clock.runFor) past a nap or an attack it would otherwise sit through.

async function openCats(page: Page) {
  await page.clock.install();
  await page.addInitScript(() => {
    const w = window as unknown as { tones: number; AudioContext: unknown };
    w.tones = 0;
    const param = { setValueAtTime() {}, exponentialRampToValueAtTime() {} };
    const node = { connect() {}, start() {}, stop() {} };
    w.AudioContext = class {
      currentTime = 0;
      sampleRate = 8000;
      state = 'running';
      destination = {};
      resume() {
        return Promise.resolve();
      }
      createGain() {
        return { ...node, gain: param };
      }
      createOscillator() {
        w.tones++;
        return { ...node, type: 'sine', frequency: param };
      }
      createBuffer(_c: number, n: number) {
        return { getChannelData: () => new Float32Array(n) };
      }
      createBufferSource() {
        w.tones++;
        return { ...node, buffer: null };
      }
    };
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/cats');
  await expect(page.getByRole('heading', { name: 'The cats' })).toBeVisible();
  let nudge = 0;
  await expect
    .poll(async () => {
      await page.mouse.move(640 + (nudge++ % 2), 400);
      return page.locator('html').getAttribute('class');
    })
    .toContain('xenocat-cursor-hidden');
}

const tones = (page: Page) => page.evaluate(() => (window as unknown as { tones: number }).tones);

/** Summons Void Tabby asleep. Returns the cat and its centre. */
async function sleepingCat(page: Page) {
  await page.getByTestId('summon-asleep-void-tabby').click();
  const cat = page.locator('[data-testid="xenocat"][data-cat-type="void-tabby"]');
  await expect(cat).toHaveAttribute('data-phase', 'sleeping');
  const box = (await cat.boundingBox())!;
  return { cat, centre: { x: box.x + box.width / 2, y: box.y + box.height / 2 } };
}

test('resting the pointer on a sleeping cat pets it: it purrs and sleeps on', async ({ page }) => {
  await openCats(page);
  const { cat, centre } = await sleepingCat(page);
  await page.mouse.move(centre.x, centre.y, { steps: 3 });
  const before = await tones(page);
  await expect(cat).toHaveAttribute('data-petted', 'true', { timeout: CAT_CONFIG.petMs + 2000 });
  await expect.poll(() => tones(page)).toBeGreaterThan(before);
  // A cat sleeps 8–22 s; petted, it is still asleep after that.
  await page.clock.runFor(CAT_CONFIG.sleepMs[1] + 1000);
  await expect(cat).toHaveAttribute('data-phase', 'sleeping');
});

test('clicking a sleeping cat wakes it at once, angry, and its attack lasts longer', async ({
  page,
}) => {
  test.setTimeout(30_000);
  await openCats(page);
  const { cat, centre } = await sleepingCat(page);
  // A click pokes where the fake cursor is drawn, a frame after the pointer moves, so
  // the pointer goes onto the cat first; but resting there for petMs would pet it
  // before the click came. Page time is held meanwhile, but for a few frames, so a
  // slow moment under load cannot run it up to petMs. (Paused a second ahead: pauseAt
  // throws for a time the running clock has passed. Nothing happens in that second:
  // the pointer is not on the cat, and it naps at least 8 s.)
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000);
  await page.mouse.move(centre.x, centre.y, { steps: 3 });
  await page.clock.runFor(100);
  await page.mouse.click(centre.x, centre.y);
  await page.clock.resume();
  await expect(cat).toHaveAttribute('data-angry', 'true');
  await expect(cat).not.toHaveAttribute('data-phase', 'sleeping');
  // The click was the cat's: nothing beneath it (a Summon button, say) got it.
  await page.waitForTimeout(300);
  await expect(page.getByTestId('xenocat')).toHaveCount(1);
  // Void Tabby's vanish lasts 3 s; angry, 1.5 times that.
  const fake = page.getByTestId('fake-cursor');
  await expect(fake).toHaveAttribute('data-effect', 'vanish', { timeout: 5000 });
  // At least 3.4 s after it began (it began before it was seen), it is still on.
  await page.clock.runFor(vanish.durationMs + 400);
  await expect(fake).toHaveAttribute('data-effect', 'vanish');
  // …and has ended 4.5 s after it began (allowing half a second more). The clock runs
  // on in real time while an assertion retries, so this one retries only briefly (for
  // the page to draw), or it would allow seconds more.
  await page.clock.runFor(vanish.durationMs * CAT_CONFIG.angryFactor - vanish.durationMs + 100);
  await expect(fake).toHaveAttribute('data-effect', '', { timeout: 500 });
});

test.describe('on a touch screen', () => {
  const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices['Pixel 7'];
  test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });

  /** /cats on a phone, a Void Tabby summoned asleep; its centre, on the screen. */
  async function sleepingCat(page: Page) {
    await page.goto('/cats');
    await expect(page.getByRole('heading', { name: 'The cats' })).toBeVisible();
    const summon = page.getByTestId('summon-asleep-void-tabby');
    await summon.scrollIntoViewIfNeeded();
    const cat = page.locator('[data-testid="xenocat"][data-cat-type="void-tabby"]');
    // A tap before hydration is lost: tap until the cat comes.
    await expect
      .poll(
        async () => {
          if ((await cat.count()) === 0) await summon.tap();
          return cat.count();
        },
        { timeout: 15_000 }
      )
      .toBe(1);
    await expect(cat).toHaveAttribute('data-phase', 'sleeping', { timeout: 10_000 });
    const box = (await cat.boundingBox())!;
    return { cat, centre: { x: box.x + box.width / 2, y: box.y + box.height / 2 } };
  }

  test('a press held on a sleeping cat pets it: it purrs and sleeps on', async ({ page }) => {
    test.setTimeout(45_000);
    const { cat, centre } = await sleepingCat(page);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [centre] });
    await expect(cat).toHaveAttribute('data-petted', 'true', { timeout: CAT_CONFIG.petMs + 3000 });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    // Petted, not poked: still asleep, and not angry.
    await page.waitForTimeout(300);
    await expect(cat).toHaveAttribute('data-phase', 'sleeping');
    await expect(cat).not.toHaveAttribute('data-angry', 'true');
  });

  test('a quick tap on a sleeping cat wakes it, angry', async ({ page }) => {
    test.setTimeout(45_000);
    const { cat, centre } = await sleepingCat(page);
    await page.touchscreen.tap(centre.x, centre.y);
    await expect(cat).toHaveAttribute('data-angry', 'true');
    await expect(cat).not.toHaveAttribute('data-phase', 'sleeping');
  });
});
