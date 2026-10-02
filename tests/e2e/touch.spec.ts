import { devices, expect, test } from '@playwright/test';

// Cats on a touch screen (/cats, no login, no database): a phone profile, so the
// page sees a coarse pointer and touch input.
test.use({ ...devices['Pixel 7'] });

test('on a touch screen the fake cursor stays off, and a cat attacks the page around the last touch', async ({
  page,
}) => {
  test.setTimeout(30_000);
  await page.goto('/cats');
  await expect(page.getByRole('heading', { name: 'The cats' })).toBeVisible();

  // Pulsar Siamese's knockback pushes the page elements around the touch.
  const button = page.getByTestId('summon-pulsar-siamese');
  await button.scrollIntoViewIfNeeded();
  // A tap before hydration is lost; tap until the cat comes.
  await expect
    .poll(async () => {
      if ((await page.getByTestId('xenocat').count()) === 0) await button.tap();
      return page.getByTestId('xenocat').count();
    })
    .toBe(1);

  // No fake cursor, and the system cursor is not hidden.
  await expect(page.getByTestId('fake-cursor')).toHaveCount(0);
  expect(await page.locator('html').getAttribute('class')).not.toContain('xenocat-cursor-hidden');

  // Once the cat has arrived it attacks: the button that was touched is pushed…
  const before = await button.evaluate((el) =>
    el.outerHTML.replace(/ data-xenocat-hit="[^"]*"/, '')
  );
  await expect(button).toHaveAttribute('data-xenocat-hit', 'push', { timeout: 5000 });
  // …and a tap meanwhile still goes through: the card's other Summon button
  // summons.
  const status = page.getByTestId('summon-status');
  const asleep = page.getByTestId('summon-asleep-pulsar-siamese');
  await asleep.tap();
  await expect(status).toContainText('Pulsar Siamese is on its way, and will nap');
  // When the effect is over (1.5 s) it is exactly as it was.
  await expect(button).not.toHaveAttribute('data-xenocat-hit', { timeout: 5000 });
  expect(await button.evaluate((el) => el.outerHTML)).toBe(before);
});
