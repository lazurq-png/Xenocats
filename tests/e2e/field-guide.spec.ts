import { type Page, expect, test } from '@playwright/test';
import { CAT_TYPES } from '@/app/ui/xenocats/cat-types';
import { GUIDE_KEY } from '@/app/ui/xenocats/field-guide';

// The field guide on /cats (no login, no database): per-cat counts kept in
// localStorage, and the wording for a visitor who has met no cat yet.

async function openCats(page: Page, stored?: Record<string, string>) {
  if (stored) {
    await page.addInitScript((items) => {
      if (sessionStorage.getItem('seeded')) return;
      for (const [key, value] of Object.entries(items)) localStorage.setItem(key, value);
      sessionStorage.setItem('seeded', '1');
    }, stored);
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/cats');
  await expect(page.getByRole('heading', { name: 'Field guide' })).toBeVisible();
  let nudge = 0;
  await expect
    .poll(async () => {
      await page.mouse.move(640 + (nudge++ % 2), 400);
      return page.locator('html').getAttribute('class');
    })
    .toContain('xenocat-cursor-hidden');
}

const entry = (page: Page, id: string) =>
  page.getByTestId(`cat-card-${id}`).getByTestId('guide-entry');

test('a new visitor sees an empty guide, every cat not met yet', async ({ page }) => {
  await openCats(page);
  await expect(page.getByTestId('guide-summary')).toContainText(
    "Your field guide is empty: you haven't met any cats yet."
  );
  for (const type of CAT_TYPES) await expect(entry(page, type.id)).toHaveText('Not met yet.');
});

test('meeting a cat and surviving its attack is counted, and kept', async ({ page }) => {
  test.setTimeout(30_000);
  await openCats(page);
  const button = page.getByTestId('summon-void-tabby');
  await button.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  const box = (await button.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await button.click();
  const voidTabby = entry(page, 'void-tabby');
  await expect(voidTabby.getByText('Met').locator('xpath=..')).toContainText('1');
  // Its attack (vanish) hits the cursor once it has arrived.
  await expect(voidTabby.getByText('Attacks survived').locator('xpath=..')).toContainText('1', {
    timeout: 10_000,
  });
  await expect(page.getByTestId('guide-summary')).toHaveText(
    "You have met 1 of the 20 cats. Each card counts how often you've met that cat and survived its attack."
  );
  await page.reload();
  await expect(entry(page, 'void-tabby').getByText('Met').locator('xpath=..')).toContainText('1');
});

test('shows stored counts; a collection left by the retired Taming game is not', async ({
  page,
}) => {
  await openCats(page, {
    [GUIDE_KEY]: JSON.stringify({ 'gravi-coon': { met: 4, survived: 3 } }),
    // Taming's old storage key (the game is gone): nothing reads it any more.
    'xenocats:tamed': JSON.stringify({ 'gravi-coon': 2, 'cryo-persian': 1 }),
  });
  const gravi = entry(page, 'gravi-coon');
  await expect(gravi.locator('dd')).toHaveText(['4', '3']);
  await expect(entry(page, 'cryo-persian')).toHaveText('Not met yet.');
  await expect(entry(page, 'void-tabby')).toHaveText('Not met yet.');
});
