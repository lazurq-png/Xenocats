import { type Page, expect, test } from '@playwright/test';
import { SURVIVAL_BEST_KEY } from '@/app/ui/xenocats/survival';
import { TAMED_KEY } from '@/app/ui/xenocats/taming';

// Fight a cat on /cats (no login, no database). These tests take the fallback path:
// pointer lock is removed before the page loads, so the game runs with the fake
// cursor and Playwright's mouse can play it.

async function openFight(page: Page, best?: number) {
  await page.addInitScript(
    ({ key, best }) => {
      Object.defineProperty(Element.prototype, 'requestPointerLock', {
        value: undefined,
        configurable: true,
      });
      if (best !== undefined) window.localStorage.setItem(key, String(best));
    },
    { key: SURVIVAL_BEST_KEY, best }
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
        return cat.getAttribute('data-doing');
      },
      { timeout: 15_000, intervals: [50] }
    )
    .toMatch(new RegExp(`^(${dodges.join('|')})$`));
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
