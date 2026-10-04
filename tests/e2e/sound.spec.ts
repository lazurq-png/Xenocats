import { type Page, expect, test } from '@playwright/test';
import { SOUND_KEY } from '@/app/ui/xenocats/sounds';

// The speaker toggle and the cats' sounds on /cats (no login, no database). Web
// Audio is replaced by a stand-in that counts the tones it is asked to play.

async function openCats(page: Page, sound?: 'on' | 'off') {
  await page.addInitScript(
    ({ key, sound }) => {
      if (sound && !sessionStorage.getItem('seeded')) {
        localStorage.setItem(key, sound);
        sessionStorage.setItem('seeded', '1');
      }
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
    },
    { key: SOUND_KEY, sound }
  );
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/cats');
  await expect(page.getByRole('heading', { name: 'The cats' })).toBeVisible();
  // Hydrated once the fake cursor has taken over (a click before that is lost).
  let nudge = 0;
  await expect
    .poll(async () => {
      await page.mouse.move(640 + (nudge++ % 2), 400);
      return page.locator('html').getAttribute('class');
    })
    .toContain('xenocat-cursor-hidden');
}

const tones = (page: Page) => page.evaluate(() => (window as unknown as { tones: number }).tones);

test('the speaker toggle is on by default, works from the keyboard and is remembered', async ({
  page,
}) => {
  await openCats(page);
  const toggle = page.getByRole('button', { name: 'Cat sounds' });
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  // Reachable with Tab like any button, and switched with Enter or Space.
  await toggle.focus();
  await expect(toggle).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate((key) => localStorage.getItem(key), SOUND_KEY)).toBe('off');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Cat sounds' })).toHaveAttribute(
    'aria-pressed',
    'false'
  );
  await page.getByRole('button', { name: 'Cat sounds' }).focus();
  await page.keyboard.press(' ');
  await expect(page.getByRole('button', { name: 'Cat sounds' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
});

test('a cat sounds as it arrives and attacks, after the first click', async ({ page }) => {
  await openCats(page);
  expect(await tones(page)).toBe(0);
  await page.getByTestId('summon-void-tabby').click();
  await expect.poll(() => tones(page)).toBeGreaterThan(0);
});

test('switched off, the cats are silent', async ({ page }) => {
  await openCats(page, 'off');
  await expect(page.getByRole('button', { name: 'Cat sounds' })).toHaveAttribute(
    'aria-pressed',
    'false'
  );
  await page.getByTestId('summon-void-tabby').click();
  await expect(page.getByTestId('xenocat')).toHaveAttribute('data-phase', 'leaving', {
    timeout: 8000,
  });
  expect(await tones(page)).toBe(0);
});
