import { type Page, expect, test } from '@playwright/test';
import { CAT_CONFIG } from '@/app/ui/xenocats/config';
import { vanish } from '@/app/ui/xenocats/effects';

// Petting and poking a sleeping cat on /cats (no login, no database). Web Audio is
// replaced by a stand-in that counts the tones it is asked to play.

async function openCats(page: Page) {
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

/** Summons Void Tabby asleep and puts the pointer on it. Returns the cat. */
async function sleepingCatUnderPointer(page: Page) {
  await page.getByTestId('summon-asleep-void-tabby').click();
  const cat = page.locator('[data-testid="xenocat"][data-cat-type="void-tabby"]');
  await expect(cat).toHaveAttribute('data-phase', 'sleeping');
  const box = (await cat.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 3 });
  return { cat, centre: { x: box.x + box.width / 2, y: box.y + box.height / 2 } };
}

test('resting the pointer on a sleeping cat pets it: it purrs and sleeps on', async ({ page }) => {
  test.setTimeout(60_000);
  await openCats(page);
  const { cat } = await sleepingCatUnderPointer(page);
  const before = await tones(page);
  await expect(cat).toHaveAttribute('data-petted', 'true', { timeout: CAT_CONFIG.petMs + 2000 });
  await expect.poll(() => tones(page)).toBeGreaterThan(before);
  // A cat sleeps 8–22 s; petted, it is still asleep after that.
  await page.waitForTimeout(CAT_CONFIG.sleepMs[1] + 1000);
  await expect(cat).toHaveAttribute('data-phase', 'sleeping');
});

test('clicking a sleeping cat wakes it at once, angry, and its attack lasts longer', async ({
  page,
}) => {
  test.setTimeout(30_000);
  await openCats(page);
  const { cat, centre } = await sleepingCatUnderPointer(page);
  await page.mouse.click(centre.x, centre.y);
  await expect(cat).toHaveAttribute('data-angry', 'true');
  await expect(cat).not.toHaveAttribute('data-phase', 'sleeping');
  // Void Tabby's vanish lasts 3 s; angry, 1.5 times that.
  const fake = page.getByTestId('fake-cursor');
  await expect(fake).toHaveAttribute('data-effect', 'vanish', { timeout: 5000 });
  // At least 3.4 s after it began (it began before it was seen), it is still on.
  await page.waitForTimeout(vanish.durationMs + 400);
  await expect(fake).toHaveAttribute('data-effect', 'vanish');
  // …and ends within 4.5 s. (The click also reached whatever was under the cat,
  // which may have summoned another cat whose attack follows.)
  await expect(fake).not.toHaveAttribute('data-effect', 'vanish', {
    timeout: vanish.durationMs * CAT_CONFIG.angryFactor,
  });
});
