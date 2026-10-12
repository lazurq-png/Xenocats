import { type Page, expect, test } from './fixtures';

// The Survival render benchmark, run on demand (BENCH=1), never in the gate or CI:
//
//   BENCH=1 E2E_NO_CAT_DEPS=1 npx playwright test tests/e2e/benchmark.spec.ts
//
// By its path, so that no other spec runs beside it and disturbs the frames.
//
// A crowded, late-game run (`?crowd=`: the six evolved weapons at level 8, the crowd
// refilled as the weapons clear it) under Chromium's CPU throttling, which stands in
// for a weak machine. It counts the browser's animation frames over 20 seconds and
// prints frames a second, the median and 95th percentile frame time, and the frames
// longer than 50 ms. It asserts that the run was crowded and the page alive, never a
// speed. Speed items compare the printed numbers before and after (progress.md).
test.skip(process.env.BENCH !== '1', 'a benchmark: run it alone, with BENCH=1');
test.setTimeout(120_000);
// One at a time: two runs side by side would measure each other.
test.describe.configure({ mode: 'serial' });

const THROTTLE = Number(process.env.BENCH_THROTTLE ?? 4);
// BENCH_GRAPHICS=light measures the light graphics setting (the default is full).
const GRAPHICS = process.env.BENCH_GRAPHICS === 'light' ? 'light' : 'full';
const SECONDS = 20;
const CROWDS = [500, 2000];

async function startRun(page: Page) {
  const area = page.getByTestId('survival-area');
  await expect
    .poll(
      async () => {
        if ((await area.count()) === 0) await page.getByTestId('survival-start').click();
        return area.count();
      },
      { timeout: 20_000 }
    )
    .toBe(1);
}

for (const crowd of CROWDS) {
  test(`${crowd} cats, CPU ${THROTTLE}× slower, ${SECONDS} s`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.addInitScript((graphics) => {
      localStorage.setItem('xenocats:survival:v1:graphics', graphics);
    }, GRAPHICS);
    await page.goto(`/cats/survival?seed=7&fps=1&crowd=${crowd}`);
    await startRun(page);
    await expect(page.getByTestId('survival-fps')).toBeVisible();
    // Let the crowd gather before measuring.
    await expect
      .poll(async () => Number(await page.getByTestId('survival-area').getAttribute('data-cats')), {
        timeout: 30_000,
      })
      .toBeGreaterThan(crowd * 0.5);

    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
    const frames = await page.evaluate(
      (ms) =>
        new Promise<number[]>((resolve) => {
          const times: number[] = [];
          let last = performance.now();
          const start = last;
          const tick = (now: number) => {
            times.push(now - last);
            last = now;
            if (now - start < ms) requestAnimationFrame(tick);
            else resolve(times);
          };
          requestAnimationFrame(tick);
        }),
      SECONDS * 1000
    );
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });

    const sorted = [...frames].sort((a, b) => a - b);
    const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
    const cats = Number(await page.getByTestId('survival-area').getAttribute('data-cats'));
    const row = {
      crowd,
      cats,
      graphics: GRAPHICS,
      throttle: `${THROTTLE}×`,
      frames: frames.length,
      fps: Number((frames.length / SECONDS).toFixed(1)),
      'median ms': Number(at(0.5).toFixed(1)),
      'p95 ms': Number(at(0.95).toFixed(1)),
      'frames > 50 ms': frames.filter((f) => f > 50).length,
    };
    console.table([row]);
    expect(frames.length).toBeGreaterThan(0);
    expect(cats).toBeGreaterThan(crowd * 0.25);
    await expect(page.getByTestId('survival-area')).toHaveAttribute('data-screen', 'playing');
  });
}
