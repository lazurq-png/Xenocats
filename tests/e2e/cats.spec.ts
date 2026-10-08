import { type Page, expect, test } from '@playwright/test';
import { CAT_TYPES } from '@/app/ui/xenocats/cat-types';

// The /cats page needs no login and no database. Each test summons a cat and
// watches what its attack does to the fake cursor.

async function openCats(page: Page, { intensity }: { intensity?: string } = {}) {
  if (intensity) {
    await page.addInitScript(
      (level) => window.localStorage.setItem('xenocats:intensity', level),
      intensity
    );
  }
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
  // Centred, so a test can move the pointer some way in any direction and stay on
  // the page.
  await button.evaluate((el) => el.scrollIntoView({ block: 'center' }));
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

test('Void Tabby makes the cursor vanish, and clicks still go through meanwhile', async ({
  page,
}) => {
  await openCats(page);
  await summon(page, 'void-tabby');
  await expect(fakeCursor(page)).toHaveAttribute('data-effect', 'vanish');
  await expect(fakeCursor(page)).toHaveCSS('opacity', '0');

  // A click during the effect is never blocked: it lands where the real pointer is.
  const status = page.getByTestId('summon-status');
  await page.getByTestId('summon-gravi-coon').click({ force: true });
  await expect(status).toHaveText('Gravi Coon is on its way.');

  // After 3 s the cursor is back (the Gravi Coon it summoned may be attacking it by then).
  await expect(fakeCursor(page)).not.toHaveAttribute('data-effect', /vanish/, { timeout: 5000 });
  await expect(fakeCursor(page)).toHaveCSS('opacity', '1');
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
      new Promise<{ cat: string; layer: string; cursor: string }[]>((resolve) => {
        const target = document.querySelector('[data-testid="xenocat-page"]')!;
        // The last frame before the shake is the baseline; then five frames during it.
        // The cat's own arrival animation moves its drawn box, so what is compared
        // is what a scroll jump would move: the cat layer's box and the cat's place
        // in it (offsetTop/offsetLeft ignore its animation), and the cursor.
        const out: { cat: string; layer: string; cursor: string }[] = [];
        let before: { cat: string; layer: string; cursor: string } | null = null;
        const sample = () => {
          const cat = document.querySelector('[data-testid="xenocat"]') as HTMLElement | null;
          const layer = document.querySelector('[data-testid="xenocat-layer"]')!;
          const cursor = document.querySelector('[data-testid="fake-cursor"]') as HTMLElement;
          if (cat) {
            const box = cursor.getBoundingClientRect();
            const layerBox = layer.getBoundingClientRect();
            const now = {
              cat: `${cat.offsetLeft},${cat.offsetTop}`,
              layer: `${layerBox.left},${layerBox.top}`,
              cursor: `${box.left},${box.top}`,
            };
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
    expect(s.cat).toBe(before.cat);
    expect(s.layer).toBe(before.layer);
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

test('Hypno Rex arrives in its artwork, with its eyes as a layer of their own', async ({
  page,
}) => {
  await openCats(page);
  await summon(page, 'hypno-rex');
  const cat = page.locator('[data-cat-type="hypno-rex"]');
  await expect(cat.locator('img:not(.xenocat-eyes)')).toHaveAttribute(
    'src',
    '/xenocats/cats/hypno-rex-awake.webp'
  );
  await expect(cat.locator('img.xenocat-eyes')).toHaveAttribute(
    'src',
    '/xenocats/cats/hypno-rex-eyes.webp'
  );
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

/** Page elements an attack is moving as it moves the cursor (puppets.ts), with their centres. */
const puppets = (page: Page) =>
  page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('body *'))
      .filter((element) => element.style.translate !== '')
      .map((element) => {
        const r = element.getBoundingClientRect();
        const frame = element.matches('[data-xenocat-frame], [data-xenocat-card]');
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, frame };
      })
  );

test('Pinball Devon bounces page elements about as it does the cursor: near the pointer, whole cards and others far off', async ({
  page,
}) => {
  await openCats(page);
  const pointer = await summon(page, 'pinball-devon');
  await expect.poll(async () => (await puppets(page)).length).toBeGreaterThanOrEqual(6);
  // Some beyond the 220 px reach round the pointer: picked anywhere on screen.
  // They bounce about, so where they are says little; where they started does.
  const moving = await puppets(page);
  expect(moving.some((box) => box.frame)).toBe(true);
  expect(moving.some((box) => distance(box, pointer) > 400)).toBe(true);
  // Pinball runs 4 s; everything is put back when it ends, and the page unmarked.
  await expect.poll(async () => (await puppets(page)).length, { timeout: 8000 }).toBe(0);
  await expect(page.locator('html')).not.toHaveAttribute('data-xenocat-puppets');
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
  // All five attack at once (their effects stack), and each stays on screen through
  // its arrival, its pounce and its departure, so all five are still there when
  // the sixth is summoned a moment later.
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

/** How far an element has been moved, px (its inline `translate`). */
const translated = (element: ReturnType<Page['getByTestId']>) =>
  element.evaluate((el) => {
    const [x, y] = (el as HTMLElement).style.translate.split(' ').map(parseFloat);
    return Math.hypot(x || 0, y || 0);
  });

test('calm: an attack flings the elements near the pointer as it does the cursor, half as far, and puts them back exactly', async ({
  page,
}) => {
  await openCats(page, { intensity: 'calm' });
  const button = page.getByTestId('summon-pulsar-siamese');
  await button.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  const before = await button.evaluate((el) => el.outerHTML);
  await summon(page, 'pulsar-siamese');
  // Knockback flings the cursor 300 px from the cat; the button goes half as far.
  await expect(fakeCursor(page)).toHaveAttribute('data-effect', 'knockback');
  await expect.poll(() => translated(button)).toBeGreaterThan(60);
  expect(await translated(button)).toBeLessThanOrEqual(151);
  // When the effect ends (1.5 s) the button is exactly as it was.
  await expect(fakeCursor(page)).toHaveAttribute('data-effect', '', { timeout: 5000 });
  await expect.poll(() => button.evaluate((el) => el.outerHTML)).toBe(before);
});

test('normal: an attack flings the element under the pointer as it does the cursor, then puts it back exactly', async ({
  page,
}) => {
  await openCats(page);
  const button = page.getByTestId('summon-pulsar-siamese');
  await button.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  const before = await button.evaluate((el) => el.outerHTML);
  await summon(page, 'pulsar-siamese');
  // Knockback flings the cursor 300 px from the cat; the button goes with it.
  await expect(fakeCursor(page)).toHaveAttribute('data-effect', 'knockback');
  await expect
    .poll(() =>
      button.evaluate((el) => {
        const [x, y] = (el as HTMLElement).style.translate.split(' ').map(parseFloat);
        return Math.hypot(x || 0, y || 0);
      })
    )
    .toBeGreaterThan(100);
  // When the effect ends (1.5 s) the button is exactly as it was.
  await expect(fakeCursor(page)).toHaveAttribute('data-effect', '', { timeout: 5000 });
  await expect.poll(() => button.evaluate((el) => el.outerHTML)).toBe(before);
});

/**
 * Marks every page element an attack could reach with the inline style it has now
 * (attribute absent and attribute empty told apart), to be compared with later.
 */
const markStyles = (page: Page) =>
  page.evaluate(() => {
    for (const el of document.querySelectorAll<HTMLElement>('body *')) {
      if (el.closest('[aria-hidden="true"], [data-xenocat-ignore]')) continue;
      el.dataset.e2eStyle = el.hasAttribute('style') ? `=${el.getAttribute('style')}` : 'none';
    }
  });

/** The marked elements whose inline style is not what it was when marked. */
const restyled = (page: Page) =>
  page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('[data-e2e-style]'))
      .filter((el) => {
        const now = el.hasAttribute('style') ? `=${el.getAttribute('style')}` : 'none';
        return now !== el.dataset.e2eStyle;
      })
      .map((el) => el.outerHTML.slice(0, 120))
  );

/** The elements an attack is acting on right now, with their boxes and displacement. */
const hit = (page: Page) =>
  page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('body *'))
      .filter((el) => el.style.translate !== '')
      .map((el) => {
        const r = el.getBoundingClientRect();
        // "0px 0px" reads back as "0px": a missing y is 0.
        const [dx = 0, dy = 0] = el.style.translate.split(' ').map((v) => parseFloat(v) || 0);
        el.dataset.e2eHit = '';
        return {
          box: [r.left, r.top, r.right, r.bottom].map(Math.round),
          dx,
          dy,
          filter: el.style.filter,
          scale: el.style.scale,
        };
      })
  );

// Each cat in turn. Every element its attack hits does what the attack does to the
// pointer (decisions.md D4); here, two of them closely, and for all twenty: every
// element is back exactly as it was when the attack ends.
for (const type of CAT_TYPES) {
  test(`${type.name}: the page elements it hits are back exactly when its attack ends`, async ({
    page,
  }) => {
    test.setTimeout(30_000);
    await openCats(page);
    const button = page.getByTestId(`summon-${type.id}`);
    await button.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await markStyles(page);
    await summon(page, type.id);
    await expect(fakeCursor(page)).toHaveAttribute('data-effect', type.effect.id);
    await expect.poll(async () => (await hit(page)).length).toBeGreaterThan(0);

    if (type.id === 'smoke-bombay') {
      // Hidden behind smoke where they stand: smoked, and not moved at all.
      const smoked = await hit(page);
      for (const element of smoked) {
        expect(element.filter).toMatch(/blur\(.+\) grayscale\(1\)/);
        expect([element.dx, element.dy]).toEqual([0, 0]);
        expect(element.scale).toBe('1');
      }
      // Each box where it was: the same as once the smoke has gone.
      const during = await page.evaluate(() =>
        Array.from(document.querySelectorAll<HTMLElement>('[data-e2e-hit]'), (el) => {
          const r = el.getBoundingClientRect();
          return [r.left, r.top, r.right, r.bottom].map(Math.round);
        })
      );
      await expect(fakeCursor(page)).toHaveAttribute('data-effect', '', { timeout: 10_000 });
      await expect.poll(() => restyled(page)).toEqual([]);
      const after = await page.evaluate(() =>
        Array.from(document.querySelectorAll<HTMLElement>('[data-e2e-hit]'), (el) => {
          const r = el.getBoundingClientRect();
          return [r.left, r.top, r.right, r.bottom].map(Math.round);
        })
      );
      expect(during).toEqual(after);
    }

    if (type.id === 'pinball-devon') {
      // Flung off, bouncing about, and never off the screen (nor further off than
      // an element already was: its box less its displacement).
      const size = page.viewportSize()!;
      let furthest = 0;
      for (let i = 0; i < 10; i++) {
        for (const { box, dx, dy } of await hit(page)) {
          const [left, top, right, bottom] = box;
          furthest = Math.max(furthest, Math.hypot(dx, dy));
          expect(left).toBeGreaterThanOrEqual(Math.min(0, left - dx) - 1);
          expect(top).toBeGreaterThanOrEqual(Math.min(0, top - dy) - 1);
          expect(right).toBeLessThanOrEqual(Math.max(size.width, right - dx) + 1);
          expect(bottom).toBeLessThanOrEqual(Math.max(size.height, bottom - dy) + 1);
        }
        await page.waitForTimeout(150);
      }
      expect(furthest).toBeGreaterThan(100);
    }

    await expect(fakeCursor(page)).toHaveAttribute('data-effect', '', {
      timeout: type.effect.durationMs + 5000,
    });
    await expect.poll(() => restyled(page)).toEqual([]);
    await expect(page.locator('html')).not.toHaveAttribute('data-xenocat-puppets');
  });
}

test('cats stay on the screen when it narrows, as when a phone is turned upright', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await openCats(page);
  // Four cats, asleep (they stay), wherever they land on the wide screen. Summoned
  // from the keyboard: a click could land on a sleeping cat and wake it instead.
  for (const type of CAT_TYPES.slice(0, 4)) {
    await page.getByTestId(`summon-asleep-${type.id}`).focus();
    await page.keyboard.press('Enter');
  }
  const cats = page.getByTestId('xenocat');
  await expect(cats).toHaveCount(4);
  await expect(page.locator('[data-testid="xenocat"][data-phase="sleeping"]')).toHaveCount(4);
  const count = 4;
  await page.setViewportSize({ width: 300, height: 700 });
  // Every one is drawn inside the narrow screen, none past its edges.
  const edges = () =>
    cats.evaluateAll((all) =>
      all.map((el) => {
        const box = el.getBoundingClientRect();
        return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
      })
    );
  await expect
    .poll(async () => {
      const boxes = await edges();
      // All of them still there (asleep), and each inside.
      return (
        boxes.length === count &&
        boxes.every((b) => b.left >= 0 && b.right <= 300 && b.top >= 0 && b.bottom <= 700)
      );
    })
    .toBe(true);
});
