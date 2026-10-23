import { test as base } from '@playwright/test';

export * from '@playwright/test';

/**
 * The browser tests' `test`: every spec imports it from here instead of from
 * `@playwright/test`.
 *
 * `catsPaused` (true unless a project or a spec says otherwise) sets, before each
 * page loads, the window property the cat layer reads when it starts
 * (`CATS_PAUSED_FLAG`, app/ui/xenocats/cat-layer.tsx): with it set, no cat comes on
 * the dashboard or /cats and no cat effect starts. The pause exists in the tests
 * alone: the app has no button, setting or stored value for it. The specs that test
 * the cats are the `cat-attacks` project (playwright.config.ts), which turns it off.
 *
 * Every page also sees no gamepad: the browser would otherwise report a controller
 * plugged into the machine running the tests, whose stick (resting off centre, or held)
 * walked the Keeper and moved focus in menus while a spec checked that he stood still.
 * The specs that test a controller fake their own (survival.spec.ts, fakeGamepads),
 * defining the same property again after this.
 */
export const test = base.extend<{ catsPaused: boolean }>({
  catsPaused: [true, { option: true }],
  page: async ({ page, catsPaused }, provide) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [] });
    });
    if (catsPaused) {
      await page.addInitScript(() => {
        (window as unknown as Record<string, unknown>).__xenocatsPaused = true;
      });
    }
    await provide(page);
  },
});
