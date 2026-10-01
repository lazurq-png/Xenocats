import { type Page, expect, test } from '@playwright/test';
import { CAT_TYPES } from '@/app/ui/xenocats/cat-types';

// The /cats page needs no login and no database. Each test summons a cat and
// watches what its attack does to the fake cursor.

async function openCats(page: Page) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/cats');
  await expect(page.getByRole('heading', { name: 'The cats' })).toBeVisible();
  // The fake cursor takes over on the first pointer move after hydration; nudge the
  // mouse until it has.
  let nudge = 0;
  await expect
    .poll(async () => {
      await page.mouse.move(640 + (nudge++ % 2), 400);
      return page.locator('html').getAttribute('class');
    })
    .toContain('xenocat-cursor-hidden');
}

const fakeCursor = (page: Page) => page.getByTestId('fake-cursor');

/** The fake cursor's drawn position, from its inline transform. */
async function cursorAt(page: Page) {
  const transform = await fakeCursor(page).evaluate((el) => (el as HTMLElement).style.transform);
  const [, x, y] = /translate3d\(([-\d.]+)px, ([-\d.]+)px/.exec(transform)!;
  return { x: Number(x), y: Number(y) };
}

/** Clicks a Summon button and returns where the real pointer was left. */
async function summon(page: Page, id: string) {
  const button = page.getByTestId(`summon-${id}`);
  // Scroll first: measuring a button below the fold and then clicking it (which
  // scrolls) would record a pointer position the page has since moved away from.
  await button.scrollIntoViewIfNeeded();
  const box = (await button.boundingBox())!;
  const pointer = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(pointer.x, pointer.y);
  await button.click();
  await expect(page.getByTestId('xenocat')).toHaveAttribute('data-cat-type', id);
  return pointer;
}

test('lists every cat type with its thumbnail, attack and Summon buttons', async ({ page }) => {
  await openCats(page);
  await expect(page.locator('[data-testid^="cat-card-"]')).toHaveCount(CAT_TYPES.length);
  for (const type of CAT_TYPES) {
    const card = page.getByTestId(`cat-card-${type.id}`);
    await expect(card.getByRole('heading', { name: type.name })).toBeVisible();
    await expect(card.getByText(type.effect.description)).toBeVisible();
    await expect(card.locator('svg, img').first()).toBeVisible();
    for (const pose of ['awake', 'asleep']) {
      await expect(
        card.getByRole('button', { name: `Summon ${type.name} ${pose}`, exact: true })
      ).toBeVisible();
    }
  }
});

test('a cat summoned asleep naps in its asleep artwork, then wakes into its awake one', async ({
  page,
}) => {
  test.setTimeout(60_000); // the nap alone can last 22 s
  await openCats(page);
  await page.getByTestId('summon-asleep-void-tabby').click();
  await expect(page.getByTestId('summon-status')).toHaveText(
    'Void Tabby is on its way, and will nap before it pounces.'
  );
  const cat = page.getByTestId('xenocat');
  await expect(cat).toHaveAttribute('data-phase', 'sleeping');
  await expect(cat.locator('img')).toHaveAttribute('src', '/xenocats/cats/void-tabby-asleep.webp');
  // It sleeps for 8-22 s (config.ts), then wakes in its awake artwork.
  await expect(cat).not.toHaveAttribute('data-phase', 'sleeping', { timeout: 25_000 });
  await expect(cat.locator('img')).toHaveAttribute('src', '/xenocats/cats/void-tabby-awake.webp');
});

test('the page swaps the system cursor for the fake one, which follows the pointer', async ({
  page,
}) => {
  await openCats(page);
  await expect(page.locator('html')).toHaveClass(/xenocat-cursor-hidden/);
  await page.mouse.move(400, 300);
  await expect(fakeCursor(page)).toHaveCSS('opacity', '1');
  await expect.poll(() => cursorAt(page)).toEqual({ x: 400, y: 300 });
});

test('Void Tabby makes the cursor vanish, and clicks are blocked meanwhile', async ({ page }) => {
  await openCats(page);
  await summon(page, 'void-tabby');
  await expect(fakeCursor(page)).toHaveAttribute('data-effect', 'vanish');
  await expect(fakeCursor(page)).toHaveCSS('opacity', '0');

  // A click during the effect does nothing: the status line does not change.
  const status = page.getByTestId('summon-status');
  const before = await status.textContent();
  await page.getByTestId('summon-gravi-coon').click({ force: true });
  await expect(status).toHaveText(before ?? '');
  await expect(page.locator('[data-cat-type="gravi-coon"]')).toHaveCount(0);

  // After 3 s the cursor is back and clicks work again.
  await expect(fakeCursor(page)).toHaveAttribute('data-effect', '', { timeout: 5000 });
  await expect(fakeCursor(page)).toHaveCSS('opacity', '1');
  await page.getByTestId('summon-gravi-coon').click();
  await expect(status).toHaveText('Gravi Coon is on its way.');
});

test('Gravi Coon makes the cursor heavy', async ({ page }) => {
  await openCats(page);
  await summon(page, 'gravi-coon');
  await expect(fakeCursor(page)).toHaveAttribute('data-effect', 'heavy');
  const start = await cursorAt(page);
  const real = { x: start.x, y: start.y };
  // Move the real pointer 200 px right in small steps; the fake one should cover ~30%.
  await page.mouse.move(real.x + 200, real.y, { steps: 20 });
  await expect
    .poll(async () => (await cursorAt(page)).x - start.x, { timeout: 2000 })
    .toBeGreaterThan(40);
  const moved = (await cursorAt(page)).x - start.x;
  expect(moved).toBeGreaterThan(40);
  expect(moved).toBeLessThan(100);
});

test('Pulsar Siamese knocks the cursor away from the cat', async ({ page }) => {
  await openCats(page);
  const pointer = await summon(page, 'pulsar-siamese');
  await expect(fakeCursor(page)).toHaveAttribute('data-effect', 'knockback');
  const cat = (await page.getByTestId('xenocat').boundingBox())!;
  const catCentre = { x: cat.x + cat.width / 2, y: cat.y + cat.height / 2 };
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y);
  // While the knockback still runs, the fake cursor gets well away from the real
  // pointer, and further from the cat than the pointer is.
  await expect
    .poll(async () => {
      const effect = await fakeCursor(page).getAttribute('data-effect');
      const fake = await cursorAt(page);
      return (
        effect === 'knockback' &&
        dist(fake, pointer) > 100 &&
        dist(fake, catCentre) > dist(pointer, catCentre)
      );
    })
    .toBe(true);
});

test('an idle summoned cat never stays: it attacks, then leaves', async ({ page }) => {
  await openCats(page);
  await summon(page, 'void-tabby');
  await expect(page.getByTestId('xenocat')).toHaveCount(0, { timeout: 8000 });
});

const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

test('Mirror Sphynx reverses the cursor', async ({ page }) => {
  await openCats(page);
  const pointer = await summon(page, 'mirror-sphynx');
  await expect(fakeCursor(page)).toHaveAttribute('data-effect', 'reverse');
  const start = await cursorAt(page);
  // The real pointer goes 120 px right and 60 px down; the fake one goes left and up.
  await page.mouse.move(pointer.x + 120, pointer.y + 60, { steps: 12 });
  await expect
    .poll(async () => {
      const now = await cursorAt(page);
      return now.x < start.x - 80 && now.y < start.y - 40;
    })
    .toBe(true);
});

test('Static Calico makes the cursor jitter around the pointer', async ({ page }) => {
  await openCats(page);
  const pointer = await summon(page, 'static-calico');
  await expect(fakeCursor(page)).toHaveAttribute('data-effect', 'jitter');
  const seen = new Set<string>();
  for (let i = 0; i < 12; i++) {
    const at = await cursorAt(page);
    expect(Math.abs(at.x - pointer.x)).toBeLessThanOrEqual(16);
    expect(Math.abs(at.y - pointer.y)).toBeLessThanOrEqual(16);
    seen.add(`${at.x},${at.y}`);
    await page.waitForTimeout(60);
  }
  // The pointer stood still, yet the cursor kept moving.
  expect(seen.size).toBeGreaterThan(3);
});

test('Cryo Persian freezes the cursor in place, iced over', async ({ page }) => {
  await openCats(page);
  const pointer = await summon(page, 'cryo-persian');
  await expect(fakeCursor(page)).toHaveAttribute('data-effect', 'freeze');
  const frozen = await cursorAt(page);
  expect(distance(frozen, pointer)).toBeLessThan(2);
  await page.mouse.move(pointer.x + 150, pointer.y - 80, { steps: 10 });
  await page.waitForTimeout(200);
  expect(distance(await cursorAt(page), frozen)).toBeLessThan(2);
  const filter = await fakeCursor(page).evaluate((el) => (el as HTMLElement).style.filter);
  expect(filter).toContain('drop-shadow');
});

test('Nebula Ragdoll makes the cursor drift away while the pointer stands still', async ({
  page,
}) => {
  await openCats(page);
  const pointer = await summon(page, 'nebula-ragdoll');
  await expect(fakeCursor(page)).toHaveAttribute('data-effect', 'drift');
  await expect
    .poll(async () => distance(await cursorAt(page), pointer), { timeout: 3000 })
    .toBeGreaterThan(80);
});

/** The fake cursor's scale, from its inline transform. */
async function cursorScale(page: Page) {
  const transform = await fakeCursor(page).evaluate((el) => (el as HTMLElement).style.transform);
  return Number(/scale\(([-\d.]+)\)/.exec(transform)![1]);
}

async function catCentre(page: Page) {
  const box = (await page.getByTestId('xenocat').boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test('Quantum Kitten teleports the cursor away from a pointer that stands still', async ({
  page,
}) => {
  await openCats(page);
  const pointer = await summon(page, 'quantum-kitten');
  await expect(fakeCursor(page)).toHaveAttribute('data-effect', 'teleport');
  const spots = new Set<string>();
  await expect
    .poll(
      async () => {
        const at = await cursorAt(page);
        if (distance(at, pointer) > 40) spots.add(`${Math.round(at.x)},${Math.round(at.y)}`);
        return spots.size;
      },
      { timeout: 3000, intervals: [100] }
    )
    .toBeGreaterThanOrEqual(2);
});

test('Magneto Bengal pulls the cursor towards itself', async ({ page }) => {
  await openCats(page);
  const pointer = await summon(page, 'magneto-bengal');
  await expect(fakeCursor(page)).toHaveAttribute('data-effect', 'magnet');
  const cat = await catCentre(page);
  await expect
    .poll(async () => distance(await cursorAt(page), cat) < distance(pointer, cat) * 0.5)
    .toBe(true);
});

test('Orbit Abyssinian makes the cursor circle it', async ({ page }) => {
  await openCats(page);
  await summon(page, 'orbit-abyssinian');
  await expect(fakeCursor(page)).toHaveAttribute('data-effect', 'orbit');
  const cat = await catCentre(page);
  const angles: number[] = [];
  for (let i = 0; i < 6; i++) {
    const at = await cursorAt(page);
    const r = distance(at, cat);
    // Clamped to the 70–140 px orbit (allowing for the screen edge and a frame's lag).
    expect(r).toBeGreaterThan(40);
    expect(r).toBeLessThan(170);
    angles.push(Math.atan2(at.y - cat.y, at.x - cat.x));
    await page.waitForTimeout(80);
  }
  expect(new Set(angles.map((a) => a.toFixed(1))).size).toBeGreaterThan(3);
});

test('Decoy Burmese adds three decoy cursors', async ({ page }) => {
  await openCats(page);
  await summon(page, 'decoy-burmese');
  await expect(fakeCursor(page)).toHaveAttribute('data-effect', 'decoys');
  const visible = page.locator('[data-testid="fake-cursor-decoy"]:not([style*="opacity: 0"])');
  await expect(visible).toHaveCount(3);
  await expect(fakeCursor(page)).toHaveCSS('opacity', '1');
});

test('Wobble Fold makes the cursor wobble around a pointer that stands still', async ({ page }) => {
  await openCats(page);
  const pointer = await summon(page, 'wobble-fold');
  await expect(fakeCursor(page)).toHaveAttribute('data-effect', 'drunk');
  let largest = 0;
  for (let i = 0; i < 10; i++) {
    largest = Math.max(largest, distance(await cursorAt(page), pointer));
    await page.waitForTimeout(100);
  }
  expect(largest).toBeGreaterThan(15);
  expect(largest).toBeLessThan(60);
});

test('Munchkin Mite shrinks the cursor to a quarter', async ({ page }) => {
  await openCats(page);
  await summon(page, 'munchkin-mite');
  await expect(fakeCursor(page)).toHaveAttribute('data-effect', 'tiny');
  await expect.poll(() => cursorScale(page)).toBe(0.25);
});

test('Titan Forest Cat grows the cursor fourfold, and shakes the page as it lands', async ({
  page,
}) => {
  await openCats(page);
  const shook = page.evaluate(
    () =>
      new Promise<boolean>((resolve) => {
        const target = document.querySelector('[data-testid="xenocat-page"]')!;
        const observer = new MutationObserver(() => {
          if (target.classList.contains('xenocat-shake')) resolve(true);
        });
        observer.observe(target, { attributes: true, attributeFilter: ['class'] });
        setTimeout(() => resolve(false), 4000);
      })
  );
  await summon(page, 'titan-forest-cat');
  expect(await shook).toBe(true);
  await expect(fakeCursor(page)).toHaveAttribute('data-effect', 'giant');
  await expect.poll(() => cursorScale(page)).toBe(4);
});

test('the stomp shake never moves the cats or the cursor, even on a scrolled page', async ({
  page,
}) => {
  await openCats(page);
  const pointer = await summon(page, 'titan-forest-cat'); // below the fold: the page is scrolled
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  // Sample while the shake class is on: the cat and the cursor must stay put.
  const samples = await page.evaluate(
    () =>
      new Promise<{ catY: number; cursor: string }[]>((resolve) => {
        const target = document.querySelector('[data-testid="xenocat-page"]')!;
        // The last frame before the shake is the baseline; then five frames during it.
        const out: { catY: number; cursor: string }[] = [];
        let before: { catY: number; cursor: string } | null = null;
        const sample = () => {
          const cat = document.querySelector('[data-testid="xenocat"]');
          const cursor = document.querySelector('[data-testid="fake-cursor"]') as HTMLElement;
          if (cat) {
            const box = cursor.getBoundingClientRect();
            const now = { catY: cat.getBoundingClientRect().top, cursor: `${box.left},${box.top}` };
            if (!target.classList.contains('xenocat-shake')) before = now;
            else {
              if (out.length === 0 && before) out.push(before);
              out.push(now);
            }
          }
          if (out.length >= 6) resolve(out);
          else requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
        setTimeout(() => resolve(out), 4000);
      })
  );
  expect(samples.length).toBeGreaterThan(0);
  const before = samples[0];
  for (const s of samples) {
    expect(Math.abs(s.catY - before.catY)).toBeLessThan(40); // the stomp's own squash, not a scroll jump
    expect(s.cursor).toBe(before.cursor);
  }
  // The cursor is still drawn at the pointer.
  const box = (await fakeCursor(page).boundingBox())!;
  expect(Math.abs(box.x - pointer.x)).toBeLessThan(40);
  expect(Math.abs(box.y - pointer.y)).toBeLessThan(40);
});

test('Lag Ragamuffin makes the cursor follow 0.8 s late', async ({ page }) => {
  await openCats(page);
  const pointer = await summon(page, 'lag-ragamuffin');
  await expect(fakeCursor(page)).toHaveAttribute('data-effect', 'delay');
  await page.waitForTimeout(900); // let the delay's own start settle
  const target = { x: pointer.x + 220, y: pointer.y };
  await page.mouse.move(target.x, target.y, { steps: 4 });
  // Just after the move the cursor is still well behind...
  expect(distance(await cursorAt(page), target)).toBeGreaterThan(120);
  // ...and it catches up about 0.8 s later.
  await expect
    .poll(async () => distance(await cursorAt(page), target), { timeout: 2500 })
    .toBeLessThan(10);
});

test('Gravity Manx makes the cursor sink', async ({ page }) => {
  await openCats(page);
  const pointer = await summon(page, 'gravity-manx');
  await expect(fakeCursor(page)).toHaveAttribute('data-effect', 'fall');
  await expect
    .poll(async () => (await cursorAt(page)).y - pointer.y, { timeout: 2000 })
    .toBeGreaterThan(100);
  expect(Math.abs((await cursorAt(page)).x - pointer.x)).toBeLessThan(2);
});

test('Smoke Bombay blurs the cursor and makes it half-transparent', async ({ page }) => {
  await openCats(page);
  await summon(page, 'smoke-bombay');
  await expect(fakeCursor(page)).toHaveAttribute('data-effect', 'blur');
  await expect(fakeCursor(page)).toHaveCSS('opacity', '0.5');
  const filter = await fakeCursor(page).evaluate((el) => (el as HTMLElement).style.filter);
  expect(filter).toContain('blur(4px)');
});

test('Hypno Rex spirals the cursor in to the middle of the screen', async ({ page }) => {
  await openCats(page);
  const pointer = await summon(page, 'hypno-rex');
  await expect(fakeCursor(page)).toHaveAttribute('data-effect', 'spiral');
  const size = page.viewportSize()!;
  const centre = { x: size.width / 2, y: size.height / 2 };
  const startDistance = distance(pointer, centre);
  await expect
    .poll(async () => distance(await cursorAt(page), centre), { timeout: 4500, intervals: [100] })
    .toBeLessThan(Math.max(startDistance * 0.3, 20));
});

test('Pinball Devon sends the cursor bouncing around the screen', async ({ page }) => {
  await openCats(page);
  const pointer = await summon(page, 'pinball-devon');
  await expect(fakeCursor(page)).toHaveAttribute('data-effect', 'bounce');
  const size = page.viewportSize()!;
  let furthest = 0;
  for (let i = 0; i < 10; i++) {
    const at = await cursorAt(page);
    expect(at.x).toBeGreaterThanOrEqual(0);
    expect(at.x).toBeLessThanOrEqual(size.width);
    expect(at.y).toBeGreaterThanOrEqual(0);
    expect(at.y).toBeLessThanOrEqual(size.height);
    furthest = Math.max(furthest, distance(at, pointer));
    await page.waitForTimeout(80);
  }
  expect(furthest).toBeGreaterThan(200);
});

test('Laser Ocicat locks the cursor to one axis', async ({ page }) => {
  await openCats(page);
  const pointer = await summon(page, 'laser-ocicat');
  await expect(fakeCursor(page)).toHaveAttribute('data-effect', 'axis-lock');
  const before = await cursorAt(page);
  await page.mouse.move(pointer.x - 100, pointer.y - 80, { steps: 8 });
  await expect
    .poll(async () => {
      const now = await cursorAt(page);
      const dx = Math.abs(now.x - before.x);
      const dy = Math.abs(now.y - before.y);
      // One axis followed the pointer, the other stayed put.
      return (dx > 80 && dy < 2) || (dy > 60 && dx < 2);
    })
    .toBe(true);
});

test('all 20 cats are on /cats, and a sixth summon is refused while five are on screen', async ({
  page,
}) => {
  await openCats(page);
  await expect(page.locator('[data-testid^="cat-card-"]')).toHaveCount(20);
  // Summon with the keyboard: it is never blocked, even once the first cats attack.
  // Lag Ragamuffin first: the first cat is the only one that attacks and leaves while
  // the rest wait their turn, and its slow arrival and departure keep it on screen
  // for about 4 s, so all five are still there when the sixth is summoned.
  const ids = ['lag-ragamuffin', 'gravi-coon', 'munchkin-mite', 'smoke-bombay', 'laser-ocicat'];
  for (const id of ids) {
    await page.getByTestId(`summon-${id}`).focus();
    await page.keyboard.press('Enter');
  }
  await expect(page.getByTestId('xenocat')).toHaveCount(5);
  await page.getByTestId('summon-hypno-rex').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('summon-status')).toHaveText(
    'No room for another cat right now. Wait for one to leave.'
  );
  await expect(page.getByTestId('xenocat')).toHaveCount(5);
  await expect(page.locator('[data-cat-type="hypno-rex"]')).toHaveCount(0);
});
