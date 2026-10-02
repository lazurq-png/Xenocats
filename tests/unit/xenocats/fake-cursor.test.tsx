// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jitter, restingLook, vanish } from '@/app/ui/xenocats/effects';
import {
  HIDE_CURSOR_CLASS,
  type XenocatCursor,
  XenocatCursorProvider,
  hideCursor,
  placeCursor,
  useXenocatCursor,
} from '@/app/ui/xenocats/fake-cursor';
import { INTENSITY_KEY } from '@/app/ui/xenocats/intensity';

function mockPointer(fine: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: fine,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }) as unknown as typeof window.matchMedia;
}

let clock = 0;
let cursor: XenocatCursor;

function CaptureCursor() {
  const current = useXenocatCursor();
  useEffect(() => {
    cursor = current;
  }, [current]);
  return null;
}

function renderPage(onClick = vi.fn()) {
  render(
    <XenocatCursorProvider now={() => clock}>
      <CaptureCursor />
      <button onClick={onClick}>Save</button>
    </XenocatCursorProvider>
  );
  return onClick;
}

beforeEach(() => {
  clock = 0;
});

afterEach(() => {
  cleanup();
});

describe('XenocatCursorProvider', () => {
  it('keeps the system cursor until the pointer moves, so there is always a cursor', () => {
    mockPointer(true);
    renderPage();
    expect(document.documentElement.classList.contains(HIDE_CURSOR_CLASS)).toBe(false);
    fireEvent.pointerMove(window, { clientX: 5, clientY: 5 });
    expect(document.documentElement.classList.contains(HIDE_CURSOR_CLASS)).toBe(true);
  });

  it('draws a fake cursor hidden from assistive technology', () => {
    mockPointer(true);
    renderPage();
    // The cursor and its decoys sit inside one aria-hidden layer.
    expect(screen.getByTestId('fake-cursor').closest('[aria-hidden="true"]')).not.toBeNull();
    for (const decoy of screen.getAllByTestId('fake-cursor-decoy')) {
      expect(decoy.closest('[aria-hidden="true"]')).not.toBeNull();
    }
  });

  it('gives the system cursor back when it unmounts', () => {
    mockPointer(true);
    renderPage();
    fireEvent.pointerMove(window, { clientX: 5, clientY: 5 });
    cleanup();
    expect(document.documentElement.classList.contains(HIDE_CURSOR_CLASS)).toBe(false);
  });

  it('does nothing on a touch screen', () => {
    mockPointer(false);
    renderPage();
    expect(document.documentElement.classList.contains(HIDE_CURSOR_CLASS)).toBe(false);
    expect(screen.queryByTestId('fake-cursor')).toBeNull();
  });

  it('never blocks a click, even while an effect runs', () => {
    mockPointer(true);
    const onClick = renderPage();
    fireEvent.pointerMove(window, { clientX: 50, clientY: 60 });
    act(() => {
      expect(cursor.attack(vanish, { x: 0, y: 0 })).toBe(true);
    });
    expect(cursor.isBusy()).toBe(true);
    // It lands on whatever is under the real pointer, wherever the cursor is drawn.
    fireEvent.click(screen.getByText('Save'), { detail: 1 });
    expect(onClick).toHaveBeenCalledTimes(1);
    const drop = new Event('drop', { bubbles: true, cancelable: true });
    screen.getByText('Save').dispatchEvent(drop);
    expect(drop.defaultPrevented).toBe(false);
    clock = vanish.durationMs;
    expect(cursor.isBusy()).toBe(false);
  });

  it('never blocks the keyboard', () => {
    mockPointer(true);
    const onKeyDown = vi.fn();
    render(
      <XenocatCursorProvider now={() => clock}>
        <CaptureCursor />
        <input aria-label="Amount" onKeyDown={onKeyDown} />
      </XenocatCursorProvider>
    );
    fireEvent.pointerMove(window, { clientX: 5, clientY: 5 });
    act(() => {
      cursor.attack(vanish, { x: 0, y: 0 });
    });
    fireEvent.keyDown(screen.getByLabelText('Amount'), { key: 'Enter' });
    expect(onKeyDown).toHaveBeenCalledTimes(1);
  });

  it('lets keyboard text selection start during an effect', () => {
    mockPointer(true);
    render(
      <XenocatCursorProvider now={() => clock}>
        <CaptureCursor />
        <p>text</p>
      </XenocatCursorProvider>
    );
    fireEvent.pointerMove(window, { clientX: 5, clientY: 5 });
    act(() => {
      cursor.attack(vanish, { x: 0, y: 0 });
    });
    const event = new Event('selectstart', { bubbles: true, cancelable: true });
    screen.getByText('text').dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('takes a second attack while one runs: the effects stack', () => {
    mockPointer(true);
    renderPage();
    fireEvent.pointerMove(window, { clientX: 5, clientY: 5 });
    act(() => {
      expect(cursor.attack(vanish, { x: 0, y: 0 })).toBe(true);
      expect(cursor.attack(vanish, { x: 0, y: 0 })).toBe(true);
    });
    expect(cursor.isBusy()).toBe(true);
  });

  it('shares one seeded random source, so a seed repeats the same numbers', () => {
    mockPointer(true);
    const draws: number[][] = [];
    for (let i = 0; i < 2; i++) {
      render(
        <XenocatCursorProvider now={() => clock} seed={123}>
          <CaptureCursor />
        </XenocatCursorProvider>
      );
      draws.push([cursor.random.next(), cursor.random.next()]);
      cleanup();
    }
    expect(draws[0]).toEqual(draws[1]);
  });

  it('draws room for decoy cursors, all hidden until an effect places them', () => {
    mockPointer(true);
    renderPage();
    const decoys = screen.getAllByTestId('fake-cursor-decoy');
    expect(decoys).toHaveLength(4);
    for (const decoy of decoys) expect(decoy.style.opacity).toBe('0');
  });

  it('hides the fake cursor when the pointer leaves the page, and matches what it hovers', async () => {
    mockPointer(true);
    renderPage();
    const fake = screen.getByTestId('fake-cursor');
    fireEvent.pointerMove(screen.getByText('Save'), { clientX: 5, clientY: 5 });
    await waitFor(() => expect(fake.style.opacity).toBe('1'));
    expect(fake.dataset.kind).toBe('pointer');
    fireEvent.pointerOut(document.body, { relatedTarget: null });
    await waitFor(() => expect(fake.style.opacity).toBe('0'));
  });
  it('every attack also attacks the page near the pointer as it does the cursor, and puts it back exactly when it ends', async () => {
    mockPointer(true);
    renderPage();
    const save = screen.getByText('Save');
    save.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 60, bottom: 20, x: 0, y: 0, width: 60, height: 20 }) as DOMRect;
    const before = save.outerHTML;
    fireEvent.pointerMove(window, { clientX: 10, clientY: 10 });
    await waitFor(() => expect(cursor.position()).not.toBeNull());
    act(() => {
      cursor.attack(vanish, { x: 300, y: 300 });
    });
    // Vanish hides the cursor: the button vanishes too.
    await waitFor(() => expect(save.style.opacity).toBe('0'));
    clock = vanish.durationMs - 1;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(save.style.opacity).toBe('0');
    clock = vanish.durationMs;
    await waitFor(() => expect(save.outerHTML).toBe(before));
  });

  it('calm: an attack only nudges the page near the pointer', async () => {
    window.localStorage.setItem(INTENSITY_KEY, 'calm');
    try {
      mockPointer(true);
      renderPage();
      const save = screen.getByText('Save');
      save.getBoundingClientRect = () =>
        ({ left: 0, top: 0, right: 60, bottom: 20, x: 0, y: 0, width: 60, height: 20 }) as DOMRect;
      const before = save.outerHTML;
      fireEvent.pointerMove(window, { clientX: 10, clientY: 10 });
      await waitFor(() => expect(cursor.position()).not.toBeNull());
      act(() => {
        cursor.attack(vanish, { x: 300, y: 300 });
      });
      expect(save.getAttribute('data-xenocat-hit')).toBe('blur');
      expect(save.style.opacity).toBe('');
      clock = vanish.durationMs;
      await waitFor(() => expect(save.outerHTML).toBe(before));
    } finally {
      window.localStorage.removeItem(INTENSITY_KEY);
    }
  });

  it('puts the page back if it goes away mid-attack', async () => {
    mockPointer(true);
    renderPage();
    const save = screen.getByText('Save');
    save.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 60, bottom: 20, x: 0, y: 0, width: 60, height: 20 }) as DOMRect;
    fireEvent.pointerMove(window, { clientX: 10, clientY: 10 });
    await waitFor(() => expect(cursor.position()).not.toBeNull());
    act(() => {
      cursor.attack(vanish, { x: 300, y: 300 });
    });
    await waitFor(() => expect(save.hasAttribute('style')).toBe(true));
    // Unmounting the provider removes the button too; keep a handle and check it.
    cleanup();
    expect(save.hasAttribute('style')).toBe(false);
  });
});

describe('on a touch screen', () => {
  // A short effect, so the test waits for its real end.
  const quickJitter = { ...jitter, durationMs: 60 };

  it('draws no fake cursor, but attacks the page around the last touch, then puts it back', async () => {
    mockPointer(false);
    const onClick = renderPage();
    expect(screen.queryByTestId('fake-cursor')).toBeNull();
    const save = screen.getByText('Save');
    save.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 60, bottom: 20, x: 0, y: 0, width: 60, height: 20 }) as DOMRect;
    const before = save.outerHTML;

    // No touch yet: nothing to attack.
    expect(cursor.attack(quickJitter, { x: 300, y: 300 })).toBe(false);
    expect(cursor.touchPoint()).toBeNull();

    fireEvent.pointerDown(window, { clientX: 10, clientY: 10, pointerType: 'touch' });
    expect(cursor.touchPoint()).toEqual({ x: 10, y: 10 });
    expect(cursor.position()).toBeNull();
    act(() => {
      expect(cursor.attack(quickJitter, { x: 300, y: 300 })).toBe(true);
    });
    expect(save.getAttribute('data-xenocat-hit')).toBe('shake');
    expect(cursor.isBusy()).toBe(true);
    // One at a time.
    expect(cursor.attack(quickJitter, { x: 300, y: 300 })).toBe(false);
    // A tap goes through, onto whatever has moved under it.
    fireEvent.click(save, { detail: 1 });
    expect(onClick).toHaveBeenCalledTimes(1);

    clock = quickJitter.durationMs;
    await waitFor(() => expect(save.outerHTML).toBe(before));
    expect(cursor.isBusy()).toBe(false);
    fireEvent.click(save, { detail: 1 });
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  // A touch screen gets the calm hits at every intensity: only near the touch.
  it('a touch far from everything: the cat pounces at nothing', () => {
    mockPointer(false);
    const onClick = renderPage();
    const save = screen.getByText('Save');
    save.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 60, bottom: 20, x: 0, y: 0, width: 60, height: 20 }) as DOMRect;
    fireEvent.pointerDown(window, { clientX: 900, clientY: 700, pointerType: 'touch' });
    act(() => {
      expect(cursor.attack({ ...vanish, durationMs: 5000 }, { x: 300, y: 300 })).toBe(true);
    });
    expect(save.hasAttribute('data-xenocat-hit')).toBe(false);
    expect(cursor.isBusy()).toBe(false);
    fireEvent.click(save, { detail: 1 });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('puts the page back if it goes away mid-attack', () => {
    mockPointer(false);
    renderPage();
    const save = screen.getByText('Save');
    save.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 60, bottom: 20, x: 0, y: 0, width: 60, height: 20 }) as DOMRect;
    fireEvent.pointerDown(window, { clientX: 10, clientY: 10, pointerType: 'touch' });
    act(() => {
      cursor.attack({ ...jitter, durationMs: 5000 }, { x: 300, y: 300 });
    });
    expect(save.hasAttribute('data-xenocat-hit')).toBe(true);
    cleanup();
    expect(save.hasAttribute('data-xenocat-hit')).toBe(false);
  });
});

describe('drawing only what changes', () => {
  const frames = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  it('a cursor at rest asks for no frames; a move or an attack wakes it until the effect ends', async () => {
    mockPointer(true);
    renderPage();
    const raf = vi.spyOn(window, 'requestAnimationFrame');
    const fake = screen.getByTestId('fake-cursor');

    fireEvent.pointerMove(window, { clientX: 10, clientY: 20 });
    await waitFor(() => expect(fake.style.transform).toContain('10px, 20px'));
    await frames(60);
    const resting = raf.mock.calls.length;
    await frames(100);
    expect(raf.mock.calls.length).toBe(resting);

    // An effect keeps it drawing, on its own, to its end; then it sleeps again.
    act(() => {
      expect(cursor.attack(vanish, { x: 300, y: 300 })).toBe(true);
    });
    await waitFor(() => expect(fake.dataset.effect).toBe('vanish'));
    await frames(60);
    expect(raf.mock.calls.length).toBeGreaterThan(resting + 2);
    clock = vanish.durationMs;
    await waitFor(() => expect(fake.dataset.effect).toBe(''));
    expect(fake.style.opacity).toBe('1');
    await frames(60);
    const after = raf.mock.calls.length;
    await frames(100);
    expect(raf.mock.calls.length).toBe(after);
    raf.mockRestore();
  });

  it('writes no style when the cursor would be drawn the same again, and hiding does not go stale', async () => {
    const element = document.createElement('div');
    let writes = 0;
    const observer = new MutationObserver((records) => (writes += records.length));
    observer.observe(element, { attributes: true, attributeFilter: ['style'] });
    const look = restingLook({ x: 5, y: 6 });

    placeCursor(element, look, look);
    await Promise.resolve();
    expect(writes).toBeGreaterThan(0);
    const first = writes;
    placeCursor(element, look, look);
    await Promise.resolve();
    expect(writes).toBe(first);

    hideCursor(element);
    expect(element.style.opacity).toBe('0');
    placeCursor(element, look, look);
    expect(element.style.opacity).toBe('1');
    observer.disconnect();
  });
});
