// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SHAKE_CLASS,
  SHAKE_MS,
  type Xenocats,
  XenocatCatsProvider,
  useXenocats,
} from '@/app/ui/xenocats/cat-layer';
import { catTypeById } from '@/app/ui/xenocats/cat-types';
import { XenocatCursorProvider } from '@/app/ui/xenocats/fake-cursor';

// Animation frames are faked and advanced explicitly, so nothing here depends on
// how fast the machine is: the cats' and the cursor's frame loops run exactly when
// `frames()` says. (Real frames + waitFor passed locally but failed on CI.)

let clock = 0;
let cats: Xenocats;

function Capture() {
  const current = useXenocats();
  useEffect(() => {
    cats = current;
  }, [current]);
  return null;
}

function renderCats() {
  render(
    <XenocatCursorProvider now={() => clock} seed={7}>
      <XenocatCatsProvider autoSpawn={false}>
        <Capture />
        <p>Invoices</p>
      </XenocatCatsProvider>
    </XenocatCursorProvider>
  );
}

/** Runs `n` animation frames (both frame loops) and lets React commit. */
async function frames(n = 2) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(20 * n);
  });
}

const phases = () => screen.getAllByTestId('xenocat').map((cat) => cat.dataset.phase);

beforeEach(() => {
  clock = 0;
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] });
  window.matchMedia = vi.fn().mockReturnValue({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('XenocatCatsProvider', () => {
  it('draws a summoned cat, hidden from assistive technology', () => {
    renderCats();
    act(() => {
      expect(cats.summon('void-tabby')).toBe(true);
    });
    const cat = screen.getByTestId('xenocat');
    expect(cat.dataset.catType).toBe('void-tabby');
    expect(cat.dataset.phase).toBe('appearing');
    expect(screen.getByTestId('xenocat-layer').getAttribute('aria-hidden')).toBe('true');
  });

  it('never shows more than five cats', () => {
    renderCats();
    act(() => {
      for (let i = 0; i < 5; i++) expect(cats.summon('gravi-coon')).toBe(true);
      expect(cats.summon('gravi-coon')).toBe(false);
    });
    expect(screen.getAllByTestId('xenocat')).toHaveLength(5);
  });

  it('refuses an unknown type', () => {
    renderCats();
    act(() => {
      expect(cats.summon('dog')).toBe(false);
    });
    expect(screen.queryByTestId('xenocat')).toBeNull();
  });

  it('a summoned cat attacks the cursor with its effect once it has arrived', async () => {
    renderCats();
    fireEvent.pointerMove(window, { clientX: 5, clientY: 5 });
    act(() => {
      cats.summon('void-tabby');
    });
    clock = 1000; // past the 800 ms entrance
    await frames();
    expect(screen.getByTestId('fake-cursor').dataset.effect).toBe('vanish');
    expect(phases()).toEqual(['attacking']);
  });

  it('with the real cursor, only one of two ready cats attacks at a time', async () => {
    renderCats();
    fireEvent.pointerMove(window, { clientX: 5, clientY: 5 });
    act(() => {
      cats.summon('void-tabby');
      cats.summon('gravi-coon');
    });
    clock = 1000; // both have arrived and want to attack
    await frames();
    expect(phases().sort()).toEqual(['attacking', 'ready']);
    // Once the first cat's 3 s vanish is over, the waiting one gets its turn.
    clock = 1000 + 3000 + 700;
    await frames();
    expect(screen.getByTestId('fake-cursor').dataset.effect).toBe('heavy');
    expect(phases()).not.toContain('ready');
    expect(phases()).toContain('attacking');
  });

  it('a ready cat waits while the pointer is off the page', async () => {
    renderCats();
    fireEvent.pointerMove(window, { clientX: 5, clientY: 5 });
    fireEvent.pointerOut(document.body, { relatedTarget: null });
    act(() => {
      cats.summon('void-tabby');
    });
    clock = 1000;
    await frames();
    expect(phases()).toEqual(['ready']);
    expect(screen.getByTestId('fake-cursor').dataset.effect).toBe('');
    // The pointer comes back: now it pounces.
    fireEvent.pointerMove(window, { clientX: 6, clientY: 5 });
    await frames();
    expect(phases()).toEqual(['attacking']);
  });

  it('a sleeping cat shows its z’s', async () => {
    render(
      <XenocatCursorProvider now={() => clock} seed={7}>
        <XenocatCatsProvider config={{ firstSpawnMs: [0, 1] }}>
          <p>Invoices</p>
        </XenocatCatsProvider>
      </XenocatCursorProvider>
    );
    await frames(); // the first tick schedules the first spawn within 1 ms
    clock = 10;
    await frames();
    expect(phases()).toEqual(['appearing']);
    clock = 3000; // every entrance is over, and no cat sleeps less than 8 s: asleep
    await frames();
    expect(phases()).toEqual(['sleeping']);
    expect(screen.getAllByText(/^z$/i)).toHaveLength(3);
  });

  it('Titan Forest Cat shakes the page content — never <body> — as it lands, briefly', async () => {
    vi.useRealTimers();
    vi.useFakeTimers({
      toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout', 'clearTimeout'],
    });
    renderCats();
    act(() => {
      cats.summon('titan-forest-cat');
    });
    const shaking = () => screen.getByTestId('xenocat-page').classList.contains(SHAKE_CLASS);
    expect(shaking()).toBe(false); // still in the air
    const landsAt = catTypeById('titan-forest-cat')!.entranceMs * 0.6;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(landsAt + 5);
    });
    expect(shaking()).toBe(true);
    expect(document.body.classList.contains(SHAKE_CLASS)).toBe(false);
    // The cat layer is outside what shakes.
    expect(screen.getByTestId('xenocat-page').contains(screen.getByTestId('xenocat-layer'))).toBe(
      false
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SHAKE_MS);
    });
    expect(shaking()).toBe(false);
  });

  it('other cats never shake the page', async () => {
    vi.useRealTimers();
    vi.useFakeTimers({
      toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout', 'clearTimeout'],
    });
    renderCats();
    act(() => {
      cats.summon('gravi-coon');
    });
    for (let t = 0; t < 1200; t += 50) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(50);
      });
      expect(screen.getByTestId('xenocat-page').classList.contains(SHAKE_CLASS)).toBe(false);
    }
  });
});

describe('a combo on the page', () => {
  it('two cats waking together attack the cursor once, with the combo effect', async () => {
    render(
      <XenocatCursorProvider now={() => clock} seed={7}>
        {/* Wide enough to pair wherever they land; a short nap so they wake together. */}
        <XenocatCatsProvider
          autoSpawn={false}
          config={{ comboDistance: 5000, sleepMs: [100, 101] }}
        >
          <Capture />
        </XenocatCatsProvider>
      </XenocatCursorProvider>
    );
    fireEvent.pointerMove(window, { clientX: 5, clientY: 5 });
    act(() => {
      // Freeze + Bounce: an ice puck.
      expect(cats.summon('cryo-persian', { asleep: true })).toBe(true);
      expect(cats.summon('pinball-devon', { asleep: true })).toBe(true);
    });
    clock = 1200; // both arrived (1000 and 1100 ms entrances): asleep
    await frames();
    clock = 1300; // both woke within 100 ms of each other: paired
    await frames();
    const cards = screen.getAllByTestId('xenocat');
    expect(cards.map((c) => c.dataset.combo)).toEqual(['ice-puck', 'ice-puck']);
    clock = 2300; // both awake: one attack, together
    await frames();
    expect(screen.getByTestId('fake-cursor').dataset.effect).toBe('ice-puck');
    expect(phases()).toEqual(['attacking', 'attacking']);
  });
});

describe('poking a sleeping cat', () => {
  it('wakes it, and the rest of that press never reaches what lies beneath', async () => {
    const onClick = vi.fn();
    render(
      <XenocatCursorProvider now={() => clock} seed={7}>
        <XenocatCatsProvider autoSpawn={false}>
          <Capture />
          <button onClick={onClick}>Delete</button>
        </XenocatCatsProvider>
      </XenocatCursorProvider>
    );
    fireEvent.pointerMove(window, { clientX: 1, clientY: 1 });
    act(() => {
      cats.summon('void-tabby', { asleep: true });
    });
    clock = 1100; // arrived: asleep
    await frames();
    const cat = screen.getByTestId('xenocat');
    expect(cat.dataset.phase).toBe('sleeping');
    const at = {
      clientX: parseFloat(cat.style.left) + 10,
      clientY: parseFloat(cat.style.top) + 10,
    };
    fireEvent.pointerMove(window, at);
    await frames();

    const button = screen.getByText('Delete');
    fireEvent.pointerDown(button, { ...at, pointerType: 'mouse' });
    fireEvent.mouseDown(button, { ...at, detail: 1 });
    fireEvent.click(button, { ...at, detail: 1 });
    expect(onClick).not.toHaveBeenCalled();
    await frames();
    expect(cat.dataset.angry).toBe('true');

    // The next press, not on a sleeping cat, goes through; so does the keyboard.
    fireEvent.pointerDown(button, { clientX: 1, clientY: 1, pointerType: 'mouse' });
    fireEvent.click(button, { clientX: 1, clientY: 1, detail: 1 });
    fireEvent.click(button, { detail: 0 });
    expect(onClick).toHaveBeenCalledTimes(2);
  });
});
